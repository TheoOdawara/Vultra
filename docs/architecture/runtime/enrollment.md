# Cadastrar o rosto de uma pessoa

Requisitos: [FR-DEV-04](../../requirements/functional/devices.md#fr-dev-04),
[FR-BIO-01 a 03](../../requirements/functional/biometrics.md),
[FR-GOV-01](../../requirements/functional/governance.md#fr-gov-01). Estágio E1.

Pré-condição: a pessoa e a câmera já existem na instituição, e a câmera está conectada.

1. **Gestor → Proxy → Serviço** (HTTPS): pede uma captura de cadastro para uma pessoa em uma câmera.
2. **Serviço**: autentica o gestor, confere que pessoa e câmera são da instituição dele e aplica a cota.
3. **Serviço → Redis → Serviço**: publica o comando, que chega à réplica em que a câmera está conectada.
4. **Serviço → Proxy → Câmera** (WebSocket sobre TLS): envia o comando de captura com a finalidade.
5. **Câmera → Proxy → Serviço**: captura o quadro e o devolve como mensagem binária.
6. **Serviço → Pipeline** (pool de processos): entrega o quadro em memória.
7. **Pipeline**: detecta o rosto, avalia qualidade e vivacidade e extrai o vetor. Qualquer recusa volta
   com o motivo e encerra o cenário sem cadastro.
8. **Serviço → PostgreSQL**: grava o cadastro biométrico da pessoa com o vetor e o registro de
   auditoria, na mesma transação e sob o contexto da instituição.
9. **Serviço → Gestor**: responde com o cadastro criado, ou com a recusa e o motivo.

O quadro é descartado ao fim do passo 7 e não aparece em nenhum passo seguinte.
