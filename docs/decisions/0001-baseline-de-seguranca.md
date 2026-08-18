# ADR-0001 — Baseline de Segurança do Vultra

> **Status:** Aceito
> **Data:** 14 de agosto de 2026
> **Escopo:** transversal — vale para todos os `apps/`, `infra/` e `firmware/`
> **Substitui:** nada. **Complementa:** `docs/backend/adrs/ADR-006` (superfície biométrica)

---

## Contexto

A auditoria de agosto de 2026 (4 eixos × 5 aplicações) encontrou 6 achados Critical e 17 High. Lidos em conjunto, eles não são 23 defeitos independentes: são o sintoma de não existir uma linha de base escrita. Cada rota decidiu sozinha se autorizava, cada arquivo decidiu sozinho como lia configuração, cada serviço decidiu sozinho o que expunha na rede. Quando não há regra, a ausência de um guard não parece um erro — parece uma rota que ninguém escreveu ainda.

Quatro exemplos concretos do estado atual, todos verificados no repositório:

- `apps/api-core/src/adapters/http/routes/face.routes.ts:56-57` guarda o estado do rate limiting em `Map` de processo. Reiniciar o processo zera a cota; subir uma segunda instância multiplica a cota pelo número de instâncias.
- `infra/docker-compose.yml:92-93` publica a porta do `ai-service` no host. O serviço processa biometria e não tem autenticação em nenhuma rota.
- Seis arquivos de `apps/api-core/src` leem variáveis de ambiente diretamente, sem módulo central e sem validação no boot.
- `0016_device_auth_migration.sql` existe em disco e não está no `_journal.json`. Em qualquer ambiente que aplique migrations pelo journal, a autenticação de dispositivo simplesmente não existe.

Este ADR fixa as regras que valem em todo o repositório, para que a próxima ausência de guard seja um erro visível e não um vazio aceitável.

---

## Decisão

### 1. Autorização é default-DENY

Toda rota HTTP declara explicitamente qual papel ou permissão exige. Uma rota que não declara é negada, não liberada.

- O guard é único e vive em `adapters/http/middleware`; nenhuma rota implementa sua própria checagem de papel.
- Autenticação (quem é) e autorização (pode o quê) são etapas distintas e ambas obrigatórias. `authPlugin` sozinho não autoriza nada.
- Todo recurso acessado por identificador é verificado contra a organização do chamador antes de ser lido ou escrito. Pertencer ao tenant não basta: o papel também precisa permitir a operação.
- O padrão de negação responde `403` sem revelar se o recurso existe.

### 2. Isolamento por tenant é dupla barreira, e nenhuma das duas é opcional

- Toda tabela com `organization_id` tem `ENABLE ROW LEVEL SECURITY` **e** `FORCE ROW LEVEL SECURITY`.
- O predicado da policy usa `NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID`, de modo que contexto ausente resulta em zero linhas — nunca em todas.
- `app.current_org_id` é definido exclusivamente dentro de `withTenantContext()`, no mesmo escopo transacional da query. Nenhum outro ponto do código chama `set_config` ou `SET LOCAL`.
- Nenhum acesso a dados de tenant acontece fora desse chokepoint, inclusive em scripts, seeds e jobs.
- O filtro por `organizationId` na camada de aplicação permanece obrigatório. RLS é a segunda linha de defesa, não a substituição da primeira.

### 3. Rate limiting é estado compartilhado e falha fechando

- O estado de cota vive em Redis. Estado de limite em memória de processo é proibido em qualquer rota.
- Nas rotas biométricas, indisponibilidade do Redis resulta em negação (`503`), nunca em liberação.
- As regras do ADR-006 seguem valendo: o limiter roda **depois** de autenticação e autorização, avalia por usuário e por organização, vence o primeiro limite excedido, e a resposta é `429` com `Retry-After`.

### 4. Superfície de rede é mínima por padrão

- **O `ai-service` nunca publica porta no host.** Ele existe apenas na rede interna `vultra-net`. O contrato real entre `api-core` e `ai-service` é a fila Redis; o HTTP do `ai-service` serve apenas ao health check interno.
- Inspecionar o `ai-service` durante o desenvolvimento se faz por `docker compose exec`, nunca publicando a porta.
- Postgres e Redis publicam porta apenas no compose de desenvolvimento local. Nenhum compose destinado a ambiente compartilhado publica porta de banco ou de fila.
- Um serviço que precise ser alcançado de fora da rede interna passa a exigir autenticação em todas as rotas exceto o health check, e isso vira um ADR próprio.

### 5. A borda IoT é autenticada, cifrada e revogável

- **ESP32-CAM fala com a `api-core` sobre TLS.** O firmware usa `WiFiClientSecure` com o certificado da CA fixado em imagem. HTTP puro é proibido em qualquer ambiente, inclusive na rede da instituição.
- Cada dispositivo tem token próprio. O token é armazenado com hash, nunca em claro, e nunca aparece em log, em resposta de API ou em mensagem de erro.
- O token carrega escopo de organização e de dispositivo. Um token válido de outra organização não lê nem escreve nada.
- Rotação e revogação são operações de primeira classe, disponíveis antes de qualquer piloto com hardware real.
- Toda migration que sustenta essas regras está registrada no `_journal.json`. Uma migration em disco fora do journal é tratada como blocker de release, não como pendência.

### 6. Configuração é centralizada e falha no boot

- Existe um módulo único de ambiente. Nenhum outro arquivo lê variáveis de ambiente diretamente.
- Toda variável é obrigatória e validada na inicialização. O processo não sobe com configuração incompleta, e o erro nomeia a variável ausente e o formato esperado.
- **Nenhum valor padrão no ponto de leitura**, em nenhum ambiente, incluindo desenvolvimento e teste. Padrões de desenvolvimento vivem apenas no arquivo de exemplo versionado, que é o contrato de quem preenche a cópia local.
- Segredo, token ou chave não é escrito no código, no compose, no Dockerfile nem em teste.

### 7. Dado sensível tem regras que nenhum requisito de produto derruba

Embeddings faciais e rótulos afetivos são dados sensíveis pelo art. 11 da LGPD. Para todos eles:

- Nenhuma imagem facial é persistida em disco, em log, em cache ou em anexo de erro.
- `audit_logs` não armazenam `frameBase64` nem embedding.
- O rótulo afetivo nunca aparece em log de aplicação.
- Revogação biométrica inutiliza o vetor, não apenas marca o registro.
- Todo acesso a dado biométrico ou afetivo gera registro de auditoria com quem, quando e sobre qual recurso — jamais com o conteúdo.

### 8. Conformidade com este ADR não é auto-declarada

Cada regra acima só é considerada atendida quando existe um teste que falha se o guard for removido. Um teste que passa no código atual prova a ausência do bug hoje; ele não prova a existência da rede de proteção. Onde o guard é uma policy de banco ou uma configuração de infraestrutura, a verificação é a mesma em espírito: quebrar deliberadamente a proteção e observar a negação.

---

## Alternativas consideradas e rejeitadas

| Alternativa | Motivo da rejeição |
|---|---|
| Autorização declarada rota a rota, sem guard central | É exatamente o estado que produziu portais sem checagem de papel e IDOR biométrico. A omissão é invisível em revisão de diff. |
| Confiar apenas em RLS para isolamento | Uma conexão com privilégio de superusuário, um script fora do chokepoint ou uma policy com predicado nulo derrubam a única barreira. |
| Rate limiting em memória por ser mais simples | Só é correto com exatamente um processo que nunca reinicia. Nenhuma das duas condições vale, nem em desenvolvimento. |
| Rate limiting que libera quando o Redis cai | Transforma indisponibilidade de infraestrutura em janela de abuso da superfície mais cara e mais sensível do sistema. |
| Publicar a porta do `ai-service` sob profile `dev` | Um profile é uma flag que se esquece ligada. `docker compose exec` resolve o caso de uso real sem criar a exposição. |
| Publicar a porta do `ai-service` com token de serviço | Adiciona um segredo e uma superfície HTTP para um serviço cujo contrato real é a fila. Complexidade sem ganho. |
| HTTP puro entre ESP32 e `api-core` dentro da LAN | O ESP32 suporta TLS via `WiFiClientSecure`. Aceitar texto claro seria um trade-off sem contrapartida técnica: o token do dispositivo trafegaria legível na rede da instituição. |
| Fallback de ambiente em desenvolvimento | Um padrão silencioso no ponto de leitura mascara configuração ausente até o ambiente em que ela importa. |

---

## Consequências

### Positivas

- A ausência de um guard passa a ser detectável: rota sem declaração é negada, e o teste correspondente falha.
- Rate limiting passa a valer com mais de uma instância, o que é pré-requisito para qualquer deploy real.
- A superfície de ataque exposta ao host cai para a `api-core` e os frontends.
- Configuração incompleta falha no boot, não em produção sob carga.
- As regras de dado sensível ficam em um lugar só, citável em relatório ao orientador e no artigo.

### Negativas

- Sete regras exigem trabalho de remediação antes de qualquer piloto. Nada aqui é retroativamente verdadeiro.
- Migrar o rate limiting para Redis acopla a disponibilidade das rotas biométricas à disponibilidade do Redis. A escolha é deliberada: negar é preferível a liberar.
- TLS no ESP32 custa RAM e latência de handshake no dispositivo, e exige distribuir e renovar o certificado da CA no firmware.
- Centralizar ambiente toca os seis arquivos que hoje leem variáveis diretamente.

### Restrições invioláveis

- Nenhuma rota é servida sem declaração explícita de papel ou permissão.
- Nenhum acesso a dado de tenant acontece fora de `withTenantContext()`.
- Nenhum estado de rate limiting vive em memória de processo.
- O `ai-service` não publica porta no host.
- Nenhum dado biométrico ou afetivo é persistido em imagem, em log ou em `audit_logs`.
- Nenhuma variável de ambiente tem valor padrão no ponto de leitura.
- Nenhuma regra deste ADR é considerada atendida sem um teste que a proteja.

---

## O que este ADR deliberadamente não decide

- **Entrega dos dados afetivos ao sistema de RH de terceiros.** Formato, granularidade, autenticação e base legal do canal seguem em aberto — ver `Q-02` e `Q-03` em `docs/requirements.md`. Nenhum dado sai do Vultra antes de um ADR próprio.
- **Política de atualização de dependências.** O `next` 15.3.3 fixado nos três frontends está em faixa de advisory e é dívida de segurança rastreada, não uma decisão pendente.
- **Aprovação ética em CEP / Plataforma Brasil.** Ver `Q-01` em `docs/requirements.md`.
- **Retenção e prazo de descarte de embeddings.** Depende do contrato com a instituição, ainda inexistente.

---

## Referências

- `docs/requirements.md` — RNF de segurança e questões abertas
- `docs/backend/adrs/ADR-006` — superfície biométrica, rate limiting e LGPD
- `docs/database/adrs/ADR-001` — pgvector e HNSW
- LGPD, Lei nº 13.709/2018, art. 6º, art. 11 e art. 46
