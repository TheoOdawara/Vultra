# Padrões de acesso

As operações que os requisitos pedem ao modelo. O volume só é conhecido onde um requisito o fixa; o
restante sai da medição de [OQ-03](../requirements/open-questions.md#oq-03).

| Operação | Lê ou escreve | Filtro e ordem | Volume |
| --- | --- | --- | --- |
| Comparar o vetor de uma captura com a galeria | Lê Cadastro biométrico | Instituição da câmera; vizinho mais próximo por distância de cosseno | 10.000 cadastros por instituição ([NFR-PERF-02](../requirements/non-functional/performance.md#nfr-perf-02)) |
| Gravar evento de reconhecimento | Escreve Evento e Registro de auditoria | — | Uma por captura; taxa a medir |
| Criar cadastro biométrico | Escreve Cadastro e Registro de auditoria | — | Uma por pessoa |
| Revogar cadastro biométrico | Escreve Cadastro e Registro de auditoria | Pessoa | Esporádico |
| Autenticar câmera | Lê Câmera | Credencial | Uma por conexão |
| Criar pessoa | Escreve Pessoa | Unicidade do identificador externo na instituição | Até 10.000 por instituição |
| Importar pessoas em lote (E2) | Escreve Pessoa | Idem, por linha | A definir na spec |
| Registrar presença (E2) | Escreve Presença | Sessão aberta da câmera; unicidade por aluno e sessão | Uma por aluno e sessão |
| Relatório de frequência (E2) | Lê Presença, Sessão e matrícula | Turma e período | A definir na spec |
| Emoção agregada (E2) | Lê Evento | Sessão ou instituição, e período; conta pessoas distintas para a supressão abaixo de 10 | A definir na spec |
