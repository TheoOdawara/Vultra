# ADR-006 — Reutilização de `biometric_profiles` e Rate Limiting da Superfície Biométrica

> **Status:** Aceito  
> **Data:** Abril de 2026  
> **Contexto:** Execução 09 da sprint de recuperação do reconhecimento facial

---

## Contexto

A sprint de recuperação biométrica consolidou a superfície HTTP definitiva em `/v1/face/*`, alinhou a migration `0015`, fechou a suíte de testes e eliminou divergências entre backlog, código e documentação legada.

Havia duas decisões arquiteturais que precisavam ser registradas de forma imutável:

1. **Modelo canônico de persistência biométrica**: decidir entre reutilizar a tabela já existente `biometric_profiles` ou introduzir um novo recurso dedicado, como `face_embeddings`.
2. **Proteção operacional da superfície biométrica**: definir onde e como aplicar rate limiting em endpoints de alto custo computacional e alto risco de abuso.

Essas decisões impactam diretamente contratos HTTP, LGPD, isolamento entre tenants, observabilidade e custo operacional.

---

## Decisão

### 1. Recurso canônico

`biometric_profiles` passa a ser o **único recurso canônico** de biometria facial no domínio.  
**Não será criada** uma nova tabela `face_embeddings`.

Essa decisão formaliza que:

- o cadastro biométrico continua persistido em `biometric_profiles`;
- o identificador operacional da biometria é o **`profileId`**;
- a revogação canônica é `DELETE /v1/face/:profileId`;
- `POST /v1/face/verify` usa `memberId?` apenas como **filtro opcional 1:N** dentro do tenant, nunca como identidade canônica do perfil;
- o legado `/v1/biometric/*` foi descontinuado por **cutover imediato** e deve responder `404`, sem alias temporário.

### 2. Contrato observável de verificação

`POST /v1/face/verify` responde **`200`** para resultados biométricos válidos, com `result` em:

- `MATCH`
- `POSSÍVEL`
- `SEM_MATCH`

Erros HTTP ficam reservados para falhas de contrato, autenticação, autorização, isolamento entre tenants, rate limiting e indisponibilidade do AI Service.

### 3. Estratégia de rate limiting biométrico

O rate limiting da superfície `/v1/face/*` será aplicado com as seguintes regras:

- **autenticação e autorização acontecem antes do limiter**;
- o limite é avaliado por **usuário** e por **organização**;
- vence o **primeiro limite excedido**;
- a resposta deve ser **`429 Too Many Requests`** com header **`Retry-After`**;
- a estratégia vale para proteger especialmente operações biométricas de maior custo e maior risco de abuso.

### 4. Regras de LGPD e auditoria

Para a superfície biométrica final:

- nenhuma imagem facial é persistida;
- `audit_logs` não armazenam `frameBase64` nem embedding;
- revogação biométrica deve inutilizar o dado sensível, zerando/removendo o vetor e marcando deleção lógica no perfil.

---

## Alternativas consideradas e rejeitadas

| Alternativa | Avaliação | Motivo da rejeição |
|-----------|-----------|--------------------|
| Criar tabela `face_embeddings` separada | Separaria semanticamente o vetor do perfil | Introduz duplicação de conceito, migração adicional, risco de inconsistência entre recurso HTTP e persistência, e complexidade desnecessária para o estágio atual |
| Manter revoke por `memberId` | API mais simples à primeira vista | Perde precisão sobre qual perfil está sendo revogado, dificulta histórico/auditoria e não representa corretamente o recurso persistido |
| `verify` retornar `404` ou `204` quando não houver match | Semântica REST aparentemente intuitiva | Mistura ausência de resultado biométrico com erro de recurso; piora contrato cliente e dificulta distinguir falha operacional de resultado legítimo |
| `verify` sem `memberId` opcional | Fluxo mais rígido | Não atende o caso 1:N dentro do tenant, reduz flexibilidade operacional e forçaria chamadas adicionais no cliente |
| Manter `/v1/biometric/*` em paralelo com `/v1/face/*` | Facilita transição temporária | Duplica superfície pública, aumenta custo de suporte e prolonga dívida técnica durante a recuperação |
| Aplicar rate limiting antes da autenticação | Mais barato computacionalmente | Limites ficam menos precisos, abrem espaço para abuso anônimo compartilhando IP/contexto e dificultam enforcement por identidade real |
| Rate limiting apenas por organização | Simples de operar | Um único usuário poderia consumir toda a cota do tenant |
| Rate limiting apenas por usuário | Simples de explicar | Não protege a organização contra uso agregado excessivo ou automação distribuída |

---

## Justificativa

Reutilizar `biometric_profiles` preserva a modelagem já existente, evita migração redundante e mantém aderência ao domínio: o sistema gerencia **perfis biométricos**, não uma coleção genérica de embeddings sem contexto.

Usar `profileId` como chave de revogação torna o contrato compatível com o recurso realmente persistido e com o histórico auditável de criação, uso e deleção.

Padronizar `verify` como `200` com resultado estruturado reduz ambiguidade para clientes e separa corretamente:

- **resultado biométrico de negócio** (`MATCH` / `POSSÍVEL` / `SEM_MATCH`)
- **falha técnica ou de política** (`4xx` / `5xx`)

Aplicar autenticação antes do rate limiting permite cotas por identidade confiável, melhorando rastreabilidade, fairness e capacidade de contenção de abuso em ambiente multitenant.

A combinação de limites por usuário e por organização protege tanto contra abuso individual quanto contra saturação agregada do tenant.

---

## Consequências

### Positivas

- elimina duplicação estrutural entre recurso HTTP e modelo persistido;
- reduz custo de manutenção e de migração;
- fortalece auditoria e rastreabilidade por `profileId`;
- simplifica clientes com contrato único em `/v1/face/*`;
- melhora proteção contra abuso com limites por usuário e organização;
- reforça conformidade LGPD ao não persistir imagem nem expor payload biométrico sensível em logs.

### Negativas

- o nome `biometric_profiles` permanece mais amplo que a feature facial específica;
- o cutover imediato para `404` exige atualização coordenada de qualquer cliente legado;
- autenticar antes de limitar mantém pequeno custo inicial de auth mesmo para chamadas que acabarão em `429`.

### Restrições invioláveis

- nenhuma imagem biométrica pode ser persistida;
- `audit_logs` não podem armazenar `frameBase64` nem embedding;
- toda operação biométrica deve filtrar por `organizationId`;
- o legado `/v1/biometric/*` não deve ser reativado;
- qualquer evolução futura de biometria deve partir de `biometric_profiles`, salvo novo ADR explícito.
