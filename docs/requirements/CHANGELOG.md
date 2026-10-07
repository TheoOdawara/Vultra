# Changelog

## 1.1.0 — 2026-10-07

Mudança decidida por Theo durante a issue #186, sem issue própria.

- **NFR-SEC-04:** sai o critério NFR-SEC-04.2, que retirava na inicialização a rota registrada sem
  declaração de permissão. A proteção passa a ser a autenticação exigida pelo router da rota, o mecanismo do
  próprio FastAPI, e o critério NFR-SEC-04.1 continua valendo.
- **NFR-SEC-06:** o erro de inicialização nomeia a variável ausente; deixa de trazer o formato esperado. A
  leitura do ambiente é uma classe de configuração tipada, sem validação escrita à mão.

## 1.0.0 — 2026-10-06

Primeira versão do SRS, levantada do zero em entrevista com Theo (issue #173).

- **Substitui `docs/requirements.md`.** O documento anterior foi escrito com foco em produto; este tem o
  trabalho acadêmico como foco e ordena tudo em três estágios (E1 núcleo, E2 painel, E3 RH).
- **Os IDs `RF-NN` e `RNF-NN` deixam de existir, sem tabela de correspondência.** As specs, os ADRs e as
  issues que os citam descrevem o plano anterior e são refeitos a partir deste SRS.
- **Adicionados:** FR-REG-01 e 02 · FR-DEV-01 a 04 · FR-BIO-01 a 04 · FR-REC-01 e 02 · FR-AFF-01 a 05 ·
  FR-ACC-01 a 03 · FR-ATT-01 a 05 · FR-RPT-01 · FR-GOV-01 · NFR-SEC-01 a 06 · NFR-PERF-01 e 02 ·
  NFR-REL-01 · NFR-FLEX-01 · NFR-INTR-01 a 03 · BR-01 a 06.
- **Abertas:** OQ-01 a OQ-07.
- **Aprovação:** todos os requisitos aprovados por Theo em 2026-10-06. NFR-PERF-01, NFR-PERF-02 e
  FR-AFF-05 só passam a ser verificáveis quando OQ-03 e OQ-05 fecharem.
