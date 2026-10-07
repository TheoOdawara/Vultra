# Riscos e dívida

Um item sem issue própria é rastreado pelo ADR ou pela questão aberta indicada.

| Risco ou dívida | Consequência | Rastreio |
| --- | --- | --- |
| O canal WebSocket sobre TLS não foi testado na ESP32-CAM real | Se não couber em memória ou não reconectar, o canal muda para HTTPS com consulta periódica e o firmware é outro | #181 · [0007](../decisions/0007-canal-da-camera-por-websocket.md) |
| O conteúdo do artigo não foi confirmado com o orientador | A prioridade do SRS inteiro pode mudar | [OQ-01](../requirements/open-questions.md#oq-01) |
| A latência máxima não tem número | NFR-PERF-01 e 02 não são verificáveis, e a escolha entre pool e fila fica aberta | [OQ-03](../requirements/open-questions.md#oq-03) |
| Os pesos do `buffalo_l` são só para pesquisa não comercial | O sistema não pode ser vendido sem licenciar ou trocar o modelo de vetor | [0006](../decisions/0006-inferencia-no-processo-do-servico.md) |
| A robustez do MiniFASNetV2 depende do modelo da câmera | A taxa de bloqueio na ESP32-CAM pode ser baixa | [0006](../decisions/0006-inferencia-no-processo-do-servico.md) |
| `fastapi-users` está em modo manutenção e prende o `sqlalchemy` na linha 2.0 | Uma migração de biblioteca de usuários no futuro | [0005](../decisions/0005-backend-unico-em-python.md) |
| Não há base legal decidida para dado biométrico e de emoção | Nenhuma pessoa fora do time pode entrar no sistema | [OQ-04](../requirements/open-questions.md#oq-04) |
| Não existe CI | Todo gate depende da máquina de quem desenvolve | #35 |
| A `main` não tem proteção configurada | A regra de Pull Request é só convenção | #158 |
| O backend anterior continua no repositório, congelado | Dois backends convivem até o E1 entregar o substituto | [0005](../decisions/0005-backend-unico-em-python.md) |
| As três specs em `docs/specs/` descrevem o plano anterior | Quem as ler sem contexto implementa o sistema errado | reescritas quando cada épico entra em sprint |
| O compose atual publica portas de banco, Redis e inferência no host | Superfície exposta em qualquer máquina que o suba | #63 cobre a porta da inferência; o compose é reescrito no E1 |
