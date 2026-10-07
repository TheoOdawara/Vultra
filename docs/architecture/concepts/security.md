# Segurança

As regras estão no [ADR 0001](../../decisions/0001-baseline-de-seguranca.md) e nos requisitos
[NFR-SEC](../../requirements/non-functional/security.md). Aqui está onde cada uma é imposta no sistema
decidido.

| Regra | Onde é imposta | Requisito |
| --- | --- | --- |
| Toda rota de dado exige autenticação e declara os papéis que a acessam | Serviço | NFR-SEC-04 |
| O gestor só opera a própria instituição | Serviço e PostgreSQL | FR-ACC-01, NFR-SEC-01 |
| O login tem cota por IP e por e-mail; Redis fora do ar nega | Serviço e Redis | FR-ACC-01 |
| A câmera autentica com credencial própria, guardada com hash | Serviço | FR-DEV-01 |
| Revogar ou rotacionar a credencial derruba a conexão aberta | Serviço | FR-DEV-02, FR-DEV-03 |
| Nada trafega sem TLS entre câmera e servidor | Proxy e firmware | NFR-SEC-02 |
| Cota por câmera e por instituição; Redis fora do ar nega | Serviço e Redis | NFR-SEC-03 |
| Segredo, credencial e vetor fora do repositório e do log | Todos os blocos | NFR-SEC-05 |
| Variável ausente impede a inicialização | Serviço e Painel | NFR-SEC-06 |
| Toda operação biométrica deixa registro de auditoria imutável, sem o conteúdo | Serviço e PostgreSQL | FR-GOV-01 |

Uma regra só conta como atendida quando existe um teste que falha se o guard for removido. Onde o guard
é uma política do banco, o teste roda contra um PostgreSQL de verdade.

O ADR 0001 nomeia mecanismos do backend anterior, como `withTenantContext()`. As regras valem; os
mecanismos do backend novo são definidos nas specs do E1. Os de acesso, isolamento e ambiente estão na
[SPEC-004](../../specs/acesso-do-gestor-e-criacao-de-pessoa.md).
