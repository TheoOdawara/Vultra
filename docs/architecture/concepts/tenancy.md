# Isolamento por instituição

Regras: [BR-03](../../requirements/business-rules.md#br-03) e
[NFR-SEC-01](../../requirements/non-functional/security.md#nfr-sec-01). Cada instituição é isolada das
outras, e o isolamento é o objeto da seção experimental do artigo
([pré-registro](../../research/pre-registro.md)).

## Duas barreiras

1. **Aplicação.** O serviço filtra toda consulta pela instituição de quem chama.
2. **Banco.** O PostgreSQL impõe o mesmo corte por RLS. Uma consulta sem o filtro da aplicação, ou sem
   contexto de instituição, devolve zero linhas de outra instituição.

## Mecanismo (E1)

Definido na [SPEC-004](../../specs/acesso-do-gestor-e-criacao-de-pessoa.md).

- Toda tabela com `institution_id` tem RLS habilitado e forçado. A política compara a coluna com
  `app.current_institution_id`; sem esse contexto, nenhuma linha passa.
- O Serviço define `app.current_institution_id` com `SET LOCAL`, na mesma transação da consulta, em um
  único ponto.
- O Serviço conecta com um papel de banco que não é dono das tabelas e não tem `BYPASSRLS`. As
  migrations usam outro papel.
- `user` e `accesstoken` ficam fora do RLS: o login procura o usuário antes de existir contexto de
  instituição. Por isso o e-mail é único no sistema inteiro.

## De onde vem a instituição

| Quem chama | Origem |
| --- | --- |
| Gestor ou professor | A sessão autenticada |
| Câmera | A credencial com que a conexão foi autenticada |

A instituição nunca é aceita de um campo enviado pelo cliente.

## Recurso de outra instituição

Responde como um recurso inexistente, sem diferença observável.

## Reconhecimento

A comparação 1:N só enxerga a galeria da instituição da câmera. Como o índice vetorial é compartilhado
e o corte é feito por RLS, a perda de recall sob esse filtro é o que o experimento mede.
