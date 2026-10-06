# Reconhecer quem passa pela câmera

Requisitos: [FR-REC-01 e 02](../../requirements/functional/recognition.md),
[FR-AFF-01 e 02](../../requirements/functional/affective.md),
[NFR-PERF-01](../../requirements/non-functional/performance.md#nfr-perf-01),
[NFR-REL-01](../../requirements/non-functional/reliability.md#nfr-rel-01). Estágio E1.

Pré-condição: a câmera está conectada e recebeu um comando de captura de reconhecimento.

1. **Câmera → Proxy → Serviço** (WebSocket sobre TLS): envia o quadro como mensagem binária.
2. **Serviço**: identifica a câmera e a instituição pela conexão autenticada e aplica a cota.
3. **Serviço → Pipeline** (pool de processos): entrega o quadro em memória.
4. **Pipeline**: detecta o rosto, avalia qualidade e vivacidade, extrai o vetor e infere a emoção.
5. **Serviço → PostgreSQL**: compara o vetor com a galeria da instituição (1:N, sob RLS).
6. **Serviço → PostgreSQL**: grava o evento de reconhecimento e o registro de auditoria.
   - Com correspondência acima do limiar: o evento leva a pessoa, a confiança e a emoção.
   - Sem correspondência, ou com recusa no passo 4: o evento vai sem pessoa, com o motivo.

Desvios que o cenário precisa tratar:

- **Orçamento de tempo estourado**: o processamento é interrompido e o evento registra o estouro.
- **Pipeline indisponível**: a captura recebe um desfecho de erro registrado, e o serviço continua
  atendendo as demais operações.

O intervalo medido pelo artigo vai do envio no passo 1 à gravação no passo 6.
