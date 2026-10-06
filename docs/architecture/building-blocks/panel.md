# Painel

`apps/web` · estágio E2 · existe como casca: uma página de placeholder e o cliente de API.

## O que faz

No E2, dá ao professor a chamada das próprias turmas e ao gestor o cadastro, o relatório de frequência
e a emoção agregada.

## O que nunca faz

- Decidir autorização: a tela reflete o que o servidor permite
  ([FR-ACC-03](../../requirements/functional/access.md#fr-acc-03)).
- Mostrar a emoção de uma pessoa identificável ([BR-05](../../requirements/business-rules.md#br-05)).

## Para mudar com segurança

- A tecnologia é reavaliada quando o E2 for planejado
  ([0005](../../decisions/0005-backend-unico-em-python.md)); hoje é a do
  [0004](../../decisions/0004-topologia-e-fundacao-do-portal.md).
- O cliente de API atual foi escrito contra o contrato do backend anterior.
- Stack, gates e fronteiras internas estão em `apps/web/AGENTS.md`.
