# SEC — Segurança

Confidencialidade, integridade e responsabilização. Todas valem desde o E1.

<a id="nfr-sec-01"></a>
## NFR-SEC-01 — Isolamento por instituição no banco

O sistema deve impor o isolamento entre instituições no próprio banco de dados, além do filtro da
aplicação.

| Atributo | Valor |
| --- | --- |
| Rationale | Uma consulta da aplicação sem filtro não pode bastar para vazar dado entre instituições; é também o mecanismo que a seção experimental do artigo mede |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **NFR-SEC-01.1** — Dada uma consulta executada sem o filtro de instituição da aplicação, quando ela
  roda no contexto da instituição A, então devolve 0 linhas de qualquer outra instituição.
- **NFR-SEC-01.2** — Dada uma consulta sem contexto de instituição, quando ela roda, então devolve 0
  linhas.

<a id="nfr-sec-02"></a>
## NFR-SEC-02 — TLS entre câmera e API

O sistema deve aceitar capturas da câmera apenas sobre TLS, nos dois ambientes.

| Atributo | Valor |
| --- | --- |
| Rationale | O quadro e a credencial da câmera não podem trafegar legíveis, nem na rede local da instituição |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **NFR-SEC-02.1** — Dada uma captura enviada sem TLS, quando ela chega, então 0 bytes do quadro são
  processados e a conexão é recusada.

<a id="nfr-sec-03"></a>
## NFR-SEC-03 — Cota que nega quando indisponível

O sistema deve limitar as requisições por câmera e por instituição, e negar a requisição quando o
controle de cota está indisponível.

| Atributo | Valor |
| --- | --- |
| Rationale | A rota de captura é a mais cara e a mais sensível; liberar quando o controle cai transforma uma falha de infraestrutura em janela de abuso |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **NFR-SEC-03.1** — Dada uma câmera acima do limite configurado, quando ela envia mais capturas, então
  100% das excedentes são negadas até o fim do bloqueio.
- **NFR-SEC-03.2** — Dado o controle de cota indisponível, quando uma captura chega, então 100% das
  capturas são negadas.

<a id="nfr-sec-04"></a>
## NFR-SEC-04 — Autorização que nega por padrão

O sistema deve negar toda requisição sem autenticação a uma rota de dado.

| Atributo | Valor |
| --- | --- |
| Rationale | Uma rota de dado aberta por esquecimento expõe a instituição inteira |
| Source | Inferido na análise; aceito por Theo em 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **NFR-SEC-04.1** — Dada uma requisição sem autenticação, quando ela atinge qualquer rota que não seja
  a verificação de saúde, então é negada; 0 rotas de dado respondem sem autenticação.

<a id="nfr-sec-05"></a>
## NFR-SEC-05 — Segredo fora do repositório e do log

O sistema deve manter segredos, credenciais e vetores fora do repositório versionado e de toda saída de
log.

| Atributo | Valor |
| --- | --- |
| Rationale | Repositório e log são lidos por mais gente e por mais tempo do que o dado que protegem |
| Source | Inferido na análise; aceito por Theo em 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **NFR-SEC-05.1** — Dada uma varredura do repositório e do log de uma execução completa do fluxo do
  núcleo, quando ela termina, então encontra 0 segredos, 0 credenciais de câmera e 0 vetores.

<a id="nfr-sec-06"></a>
## NFR-SEC-06 — Ambiente obrigatório na inicialização

O sistema deve recusar a inicialização quando falta uma variável de ambiente, nomeando a variável.

| Atributo | Valor |
| --- | --- |
| Rationale | Um valor padrão silencioso esconde a configuração ausente até o ambiente em que ela importa |
| Source | Inferido na análise; aceito por Theo em 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **NFR-SEC-06.1** — Dada uma variável ausente, quando qualquer processo do sistema inicia, então ele
  encerra com erro que nomeia a variável; 0 variáveis têm valor padrão no ponto de leitura.
