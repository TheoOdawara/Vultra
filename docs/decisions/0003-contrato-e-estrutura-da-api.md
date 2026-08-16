# ADR-0003 — Contrato público e estrutura interna da `api-core`

> **Status:** Aceito
> **Data:** 16 de agosto de 2026
> **Escopo:** `apps/api-core` e todo cliente do contrato `/v1`
> **Emenda:** `docs/backend/adrs/ADR-004` (estrutura de pastas) e `docs/backend/adrs/ADR-006` (caminho da superfície biométrica)
> **Complementa:** `docs/decisions/0001-baseline-de-seguranca.md`
> **Especificação:** `docs/specs/api-core-contrato-e-estrutura.md`

---

## Contexto

A revisão de agosto de 2026 encontrou na `api-core` um padrão diferente do que o `ai-service`
apresentou. A regra de dependência hexagonal está intacta: nenhum arquivo de `src/core/` importa de
`adapters/` ou `infrastructure/`, os repositórios passam por `withTenantContext()` sem exceção, as policies
de RLS usam `NULLIF(current_setting(...))` e portanto falham fechando, e `checkPermission` nega por padrão.
O typecheck passa. Os 111 testes passam.

O que está errado é o que fica em volta da regra.

**A composição é feita por efeito colateral.** Sete arquivos de rota declaram `let _useCase: T | null = null`
no topo do módulo e recebem as dependências por uma função `init<X>Routes()` chamada pelo `server.ts`.
A consequência mecânica são **26** guards `if (!_x) throw new Error("...not initialized")` espalhados pelos
handlers, ordem de importação virando comportamento, e rotas instanciando repositórios diretamente
(`new MemberRepository(db)` dentro de `members.routes.ts`). O `container.ts` existe e monta apenas a fila.

**O contrato público nunca foi desenhado.** Ele cresceu rota a rota, e o resultado é verificável:

- `frontend-professores` chama `/v1/attendance/records` e `/v1/biometric/`. Nenhuma das duas existe — a
  primeira nunca existiu, a segunda foi morta pelo ADR-006. O contrato já está quebrado em silêncio.
- De sete coleções, **uma** pagina. `/v1/face/list`, `/v1/devices` e os registros de uma sessão devolvem o
  conjunto inteiro, contra RF-21.
- A única coleção paginada declara `limit` e `offset` como `t.String()` e os converte com `Number()` sem
  validação, então `?limit=abc` produz `NaN`.
- Não existe correlation id em lugar nenhum, o que deixa RNF-15 sem base.
- A forma de erro é `{ error, message }`, sem código estável separado da prosa e sem detalhe por campo.
- `POST /v1/attendance/record` — a rota do ESP32, que consome quadro facial — não tem cota nem teto de
  payload, enquanto `/v1/face/*` tem os dois.
- `/v1/health/ai-service` é público e devolve contagem de falhas e horário da última falha.
- Rotas nomeiam verbos no caminho (`face/enroll`, `face/verify`, `devices/:id/rotate-key`) enquanto o
  próprio `DELETE /v1/face/:profileId` revela que o recurso é um perfil biométrico, não uma "face".

**Duas tabelas com `organization_id` não têm RLS:** `audit_logs` e `organizations`. A trilha exigida por
RNF-04 é justamente a que não tem isolamento no banco, apesar de o repositório chamar
`withTenantContext()` e do cabeçalho do arquivo afirmar o contrário.

**Os testes não protegem nada disso.** São 111 testes em 428 ms porque tudo é `mock.module` — nenhum toca
Postgres. Os testes de isolamento entre tenants mockam o repositório, logo provam que o mock devolve o que
mandaram devolver. RLS, as policies e `withTenantContext` não têm rede nenhuma, o que é exatamente o R-02
de `docs/requirements.md`.

Nada disso tem consumidor em produção: `firmware/esp32-cam/` contém um `.gitkeep`, nenhum piloto rodou e
RNF-22 proíbe dado real antes de Q-01 fechar. É a janela mais barata que vai existir para consertar.

---

## Decisão

### 1. A estrutura passa a ser fatiada por módulo de negócio

`src/modules/<módulo>/` com `domain/`, `application/` e `infrastructure/` dentro de cada um, mais
`src/shared/kernel` e `src/shared/infra`. Os módulos são `identity`, `classes`, `devices`, `biometrics`,
`attendance` e `reports`.

Isto **emenda o ADR-004**, que decidiu camada técnica de primeiro nível. O ADR-004 não foi violado — o
código o obedece. O que mudou é a avaliação: a camada técnica de primeiro nível espalha uma capacidade por
quatro pastas distantes, e trocar o contrato de biometria hoje significa abrir `core/use-cases/biometrics`,
`adapters/http/routes`, `adapters/repositories` e `core/ports` em quatro pontos da árvore.

Regras de nomenclatura e fronteira seguem a skill `hexagonal-architecture`: porta nomeada pela capacidade e
sem prefixo `I`, adaptador carregando a tecnologia no nome, módulo alcançando outro apenas por
`<módulo>.wiring.ts`, teste ao lado do arquivo que testa.

### 2. A fiação é explícita, e o singleton mutável de módulo é proibido

Cada módulo tem uma raiz de composição própria que constrói suas dependências e expõe sua superfície.
`main.ts` registra os módulos e escuta. O padrão `init<X>Routes()` com estado mutável no topo do módulo é
eliminado, e com ele os 26 guards de não inicializado — que são o custo obrigatório do padrão, não um
descuido de quem escreveu.

### 3. `/v1` é refeito de uma vez, sem `/v2` e sem janela de depreciação

Não há consumidor externo e o firmware não existe. Um `/v2` paralelo dobraria a superfície de um app que
ainda não tem CI, para proteger clientes que são todos deste repositório.

Ficam decididos, para toda rota: envelope único de coleção com cursor opaco, `limit` padrão `50` e máximo
`100` sem `total`; forma de erro `{ error: { code, message, details?, correlationId } }` com código estável;
correlation id aceito ou gerado e ecoado em toda resposta; `additionalProperties: false` em todo corpo e
query; campo de servidor não assinalável pelo cliente.

### 4. O caminho biométrico passa a nomear o recurso, não o verbo

`/v1/face/*` é substituído por `/v1/biometric-profiles` e `/v1/biometric-verifications`. Isto **emenda o
ADR-006 apenas no caminho**; tudo o que ele decidiu de substância continua valendo — `biometric_profiles` é
o recurso canônico, `profileId` é a chave de revogação, `verify` responde `200` com resultado estruturado,
`memberId` é filtro 1:N e não identidade. O caminho novo é mais fiel ao ADR-006 do que `/v1/face/*` era.

O valor de enum `POSSÍVEL` passa a `POSSIBLE`. Valor de enum em contrato público é código, e código é
inglês.

### 5. A rota do dispositivo passa a ter as mesmas proteções da rota de usuário

`POST /v1/attendance/sessions/{sessionId}/records` ganha cota por dispositivo e por organização, teto de
payload, e `sessionId` no caminho em vez do corpo. `organizationId` e `deviceId` vêm do token, nunca do
cliente.

### 6. Três papéis, e o dado agregado é autenticado

`gestor`, `professor` e `rh`. O aluno não autentica — o Vultra é ferramenta de gestão interna nesta
entrega, e papel autenticado sem cliente é superfície sem consumidor. O papel `rh` existe porque o dado
agregado não pode ser público, e alcança **apenas** `GET /v1/reports/wellbeing`; perde o acesso a biometria
que o código atual lhe dá sem que requisito nenhum o peça.

### 7. RF-11 é atendido por polling condicional, não por conexão persistente

A coleção de registros de uma sessão devolve `ETag`; o portal repete o `GET` com `If-None-Match` e recebe
`304` enquanto nada muda. Zero infraestrutura nova, funciona atrás de qualquer proxy, e sobrevive ao celular
do professor trocar de rede — que é o cenário real de RNF-16.

### 8. Concorrência otimista apenas na sessão de chamada

`ETag` e `If-Match` no `PATCH` da sessão. É o único recurso onde duas pessoas mexem ao mesmo tempo. Nos
demais, exigir versionamento seria cerimônia paga em cada rota e em cada cliente.

### 9. RNF-03 ganha um executor

`POST /v1/retention-runs` apaga o que passou do prazo, com os prazos declarados na spec e teto de `10000`
linhas por execução. Não há agendador dentro do `api-core`: quem chama periodicamente é a instância. Um
agendador embutido duplicaria a execução com mais de um processo e misturaria responsabilidade de job com a
de servir HTTP.

### 10. A trilha de auditoria é legível

`GET /v1/audit-logs` para o gestor, paginada e filtrável. Não existe rota de escrita nem de deleção — é
assim que a imutabilidade de RNF-04 fica garantida pela ausência de caminho, não por convenção. Uma trilha
que ninguém consegue ler não responde a pedido de titular nem a auditoria.

### 11. As duas tabelas sem RLS passam a ter

`audit_logs` e `organizations` recebem `ENABLE` e `FORCE ROW LEVEL SECURITY` com o mesmo predicado das
outras seis. E a verificação passa a rodar contra um Postgres real: uma policy só está provada quando
removê-la faz um teste falhar (ADR-0001 §8).

---

## Alternativas consideradas e rejeitadas

| Alternativa | Motivo da rejeição |
|---|---|
| Manter a camada técnica do ADR-004 e só limpar a fiação | Resolve os 26 guards e deixa a capacidade espalhada por quatro pastas. Metade do problema, com o mesmo custo de migração. |
| Criar `/v2` e manter `/v1` congelado | Dobra a superfície e o esforço de teste para proteger clientes que são todos deste repositório, num app sem CI. O custo é real e o benefício é hipotético. |
| Só reestruturar por dentro, sem tocar no contrato | Deixaria RF-21, RNF-15, a forma de erro e a rota do ESP32 sem proteção exatamente como estão — que é a metade mais grave da revisão. |
| Manter `/v1/face/*` para evitar mais um rename | O ADR-006 já renomeou uma vez, e o caminho que ele fixou contradiz o recurso que ele próprio declarou canônico. Renomear de novo agora custa editar código nosso; depois custa reflashar hardware. |
| SSE ou WebSocket para RF-11 | Segura conexão por aula inteira e exige reconexão com replay para não perder evento. O fluxo é só servidor para cliente e o volume é de uma turma — polling condicional resolve com `304`. |
| Concorrência otimista em todos os recursos mutáveis | Contrato uniforme e mais previsível, mas paga versionamento em cada rota e em cada cliente para uma colisão que só acontece na sessão. |
| Manter o papel `rh` com acesso a biometria | Nenhum requisito o pede, e `requirements.md` diz explicitamente que a equipe de RH não é usuária da nossa interface. É permissão sem finalidade declarada sobre dado do art. 11. |
| Manter o papel `student` autenticado | Não há interface de aluno nesta entrega. Um papel com sessão e sem cliente é superfície de ataque que ninguém exercita nem observa. |
| Agendador de retenção dentro do `api-core` | Duplica a execução com mais de uma instância e acopla ciclo de job ao ciclo do servidor HTTP. |
| Deixar a trilha de auditoria só para escrita | Transforma pedido de titular da LGPD em tarefa manual de desenvolvedor, e a Q-01 vai perguntar por ela. |
| Migrar tudo num único PR | É como o ciclo anterior fechou vermelho. Dez mil linhas sem CI, com gate rodando só na máquina de quem desenvolve. |

---

## Consequências

### Positivas

- Uma capacidade passa a caber numa pasta: trocar o contrato de biometria abre `modules/biometrics` e nada
  mais.
- Os 26 guards de não inicializado somem porque a causa some, não porque foram tratados um a um.
- RF-21, RNF-15 e a forma de erro deixam de depender de cada rota lembrar-se deles: viram convenção única
  aplicada na fronteira.
- A rota mais exposta do sistema — a que um atacante na rede da instituição alcança — passa a ter as mesmas
  proteções da rota de usuário.
- Q-06 fecha, o que destrava RF-17 e portanto a contribuição de pesquisa.
- Falta passa a ser computável, porque a matrícula existe.
- Teste contra Postgres real dá a RLS a primeira rede de proteção que ela já teve.

### Negativas

- A migração toca os 79 arquivos de `src/`. É a maior mudança estrutural desde o início do projeto, com
  entrega dura em dezembro.
- Os três frontends ficam quebrados contra o contrato novo até serem revisados — sobre um contrato que já
  os quebra hoje, mas a quebra passa a ser mais ampla.
- Turma é um módulo inteiro novo com migration, matrícula e escopo de professor, e nada dele existe.
- Polling condicional gasta uma requisição por intervalo mesmo quando nada muda. O `304` é barato, o
  round-trip não é zero.
- Cota em Redis acopla a disponibilidade de toda a API à do Redis. É a mesma escolha deliberada do
  ADR-0001: negar é preferível a liberar.
- Teste contra Postgres real torna o gate mais lento e exige container no ambiente de quem desenvolve.

### Restrições invioláveis

- Nenhuma rota é registrada sem declaração explícita de permissão; o boot falha se alguma for.
- Nenhum arquivo lê o ambiente fora do módulo de configuração.
- Nenhum tipo de framework, ORM ou transporte aparece em assinatura de use-case.
- Nenhum módulo importa o interior de outro.
- Nenhuma coleção é devolvida sem limite.
- Nenhum estado de cota vive em memória de processo.
- Nenhum recorte afetivo com menos de `5` membros distintos é exposto.
- Nenhuma regra desta decisão é considerada atendida sem um teste que falhe quando o guard for removido.

---

## O que este ADR deliberadamente não decide

- **A entrega do dado agregado ao sistema de RH (RF-19).** Segue com a Q-02, e o ADR-0001 já decidiu que
  nada sai do Vultra antes de um ADR próprio.
- **A integração com o sistema cadastral da instituição** (Q-04, terceira via). O cadastro unitário e a
  importação em lote cobrem a demonstração; a integração exige instituição parceira que não existe.
- **O ajuste dos três frontends.** Fica para revisão e planejamento próprios.
- **Quem chama `POST /v1/retention-runs` periodicamente.** É decisão de infraestrutura, não de aplicação.
- **A base legal da correlação entre estado afetivo e professor.** Segue com a Q-03.

---

## Referências

- `docs/specs/api-core-contrato-e-estrutura.md` — a especificação que esta decisão sustenta
- `docs/decisions/0001-baseline-de-seguranca.md` — regras transversais de segurança
- `docs/backend/adrs/ADR-004` — estrutura de pastas, emendado por esta decisão
- `docs/backend/adrs/ADR-006` — superfície biométrica, emendado no caminho
- `docs/specs/ai-service-pipeline-inferencia.md` — contrato de inferência que esta API consome
- `docs/requirements.md` — RF, RNF e questões abertas
