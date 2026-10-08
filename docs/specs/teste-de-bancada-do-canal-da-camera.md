# SPEC-005 — Testar em bancada o canal WebSocket sobre TLS da câmera

> **Status:** fechada
> **Perfil:** API
> **Módulo:** `esp32-cam`
> **Epic:** — (issue avulsa #181, sem sub-issues)
> **Requisitos:** nenhum é coberto. O teste decide o [ADR 0007](../decisions/0007-canal-da-camera-por-websocket.md), que sustenta NFR-SEC-02 e NFR-PERF-01
> **Sprint:** 1

O ADR 0007 está `proposed` e só é aceito com um teste na ESP32-CAM real. Esta spec define o teste: o que
é gravado na placa, contra o que ela conecta, o que é medido e qual número aprova ou reprova o canal. O
resultado decide o canal do épico #178.

## Premissas confirmadas

Confirmadas por Theo em 2026-10-08.

1. O firmware de bancada é ESP-IDF puro, construído com `idf.py`. Não é Arduino nem PlatformIO.
2. O código de bancada é versionado em `esp32-cam/` e é a semente do firmware real.
3. O outro lado da conexão é um servidor de bancada mínimo, em Python, com TLS próprio. Não é o Proxy TLS
   nem uma rota de `apps/api`.
4. O certificado do servidor é emitido por uma CA local gerada para o teste, e o PEM dessa CA é embutido
   no firmware. O teste tem o caso negativo: um servidor assinado por outra CA é recusado.
5. Não há credencial de câmera nem comando de captura. A câmera conecta e envia quadros por conta
   própria.
6. Uma issue, uma branch `chore/181-camera-channel-bench`, duas entregas.
7. A placa é gravada pelo adaptador USB-serial de Theo, que executa a parte física: gravar, derrubar o
   Wi-Fi e colar o log serial.

## Valores confirmados

Confirmados por Theo em 2026-10-08.

| Valor | Decisão |
| --- | --- |
| Quadro | VGA 640×480, JPEG |
| Sequência de memória | 100 quadros seguidos, um a cada 2 s |
| Variação de heap aceita | o heap interno livre depois do quadro 100 difere em no máximo 5% do medido depois do quadro 1 |
| Queda de rede | Wi-Fi desligado por 60 s, 3 vezes |
| Prazo de reconexão | um quadro entregue em até 30 s depois de a rede voltar, sem intervenção manual |
| Tempo do handshake TLS | registrado; não reprova o teste |

## Versões

Consultadas em 2026-10-08, no GitHub da Espressif, no registro de componentes e no PyPI.

| Dependência | Versão |
| --- | --- |
| ESP-IDF | v6.1 |
| `espressif/esp_websocket_client` | 1.8.0 |
| `espressif/esp32-camera` | 2.1.8 |
| `websockets` (servidor de bancada) | 17.2 |

Os dois componentes declaram compatibilidade com ESP-IDF a partir da 5.x. A compatibilidade real com a
v6.1 é provada pelo build da Task 1.

---

## Acceptance Criteria

### Contrato

N/A — o teste não cria rota HTTP. O contrato é a conexão abaixo.

| Lado | O que faz |
| --- | --- |
| Câmera | abre `wss://<host>:<porta>/`, valida a cadeia do servidor contra a CA embutida e o nome contra o certificado, e envia cada quadro como uma mensagem binária |
| Servidor de bancada | aceita a conexão TLS, recebe a mensagem binária, confere os marcadores JPEG e imprime uma linha por quadro |

### Request

Uma mensagem binária WebSocket por quadro. O conteúdo é o JPEG inteiro, sem cabeçalho próprio.

### Response

N/A — o servidor de bancada não responde ao quadro.

### Perfis e privilégios

N/A — não há usuário nem credencial neste teste. A credencial da câmera é do épico #177.

### Configuração do firmware

Três opções de `Kconfig`, definidas em `idf.py menuconfig` e gravadas no `sdkconfig`, que não é
versionado. Nenhuma tem valor padrão, e o build falha quando uma delas está vazia.

| Opção | Tipo | Obrigatória | Origem |
| --- | --- | --- | --- |
| `BENCH_WIFI_SSID` | string | Sim | a rede de bancada de Theo |
| `BENCH_WIFI_PASSWORD` | string | Sim | a rede de bancada de Theo |
| `BENCH_SERVER_URI` | string, começa com `wss://` | Sim | o IP da máquina que roda o servidor de bancada, porta `8443` |

### Certificados

Gerados com `openssl` em `esp32-cam/bench/certs/`, pasta fora do versionamento. Os comandos ficam em
`esp32-cam/AGENTS.md`.

| Arquivo | Para quê |
| --- | --- |
| `ca.pem`, `ca.key` | a CA de bancada; `ca.pem` é embutido no firmware |
| `server.pem`, `server.key` | o servidor, assinado pela CA de bancada, com o IP da máquina no SAN |
| `other-ca.pem`, `other-ca.key`, `other-server.pem`, `other-server.key` | o caso negativo: um servidor com o mesmo IP no SAN, assinado por outra CA |

---

## Regras de Negócio

### 1. Autorização

N/A — o teste não autentica a câmera. O que ele prova é o outro sentido: a câmera autentica o servidor.

### 2. A câmera só conecta a um servidor assinado pela CA embutida

- A validação do certificado e do nome do servidor fica ligada; nenhuma opção do cliente que a pule é
  usada.
- Com o servidor assinado pela CA de bancada, a conexão abre e o firmware registra:
  > `tls handshake_ms=<n>`
- Com o servidor assinado por outra CA, a conexão não abre, nenhum quadro é enviado e o firmware
  registra:
  > `websocket connect failed`

### 3. Cada quadro é uma mensagem binária, com a memória medida antes e depois

- O firmware captura um quadro VGA em JPEG a cada 2 s, envia-o e devolve o buffer ao driver da câmera.
- Para cada quadro o firmware registra o heap interno livre antes da captura, depois do envio, e o
  mínimo desde o boot:
  > `frame seq=<n> bytes=<n> heap_before=<n> heap_after=<n> heap_min=<n>`
- O servidor de bancada registra, para cada mensagem binária, o tamanho e se ela começa com `FF D8` e
  termina com `FF D9`:
  > `frame seq=<n> bytes=<n> valid=<true|false>`
- A sequência de memória são os quadros 1 a 100 depois do boot. Ela é aprovada quando os 100 chegam com
  `valid=true`, não há reset nem falha de alocação, e `heap_after` do quadro 100 difere em no máximo 5%
  de `heap_after` do quadro 1.

### 4. A câmera reconecta sozinha depois de uma queda de rede

- Depois do quadro 100 o firmware continua enviando um quadro a cada 2 s.
- Quando o Wi-Fi cai, o firmware registra:
  > `wifi disconnected`
- Quando a rede volta e o primeiro quadro é entregue, o firmware registra o tempo entre receber o IP e
  concluir o envio desse quadro:
  > `reconnected network_to_frame_ms=<n>`
- A reconexão é aprovada quando, em 3 quedas de 60 s, as 3 linhas trazem `network_to_frame_ms` de no
  máximo 30000, sem reset manual e sem regravar a placa.

### 5. O quadro existe apenas em memória

- O servidor de bancada não grava o quadro em disco nem o imprime: registra só o tamanho e a validade.
- O firmware não grava o quadro na flash nem no cartão SD.

### 6. O resultado decide o ADR 0007

- Aprovadas as regras 2, 3 e 4, o ADR 0007 passa a `accepted` e ganha a seção `Resultado do teste de
  bancada`, com a placa, as versões, o tempo de handshake, o heap do quadro 1 e do quadro 100, o
  `heap_min` e os três tempos de reconexão.
- Reprovada qualquer uma delas, o ADR 0007 é reescrito com HTTPS e consulta periódica como decisão, e a
  mesma seção registra o que reprovou e com que número.

### 7. Persistência e Auditoria

- **Tabelas/colunas alteradas:** N/A — o teste não toca o banco.
- **Auditoria:** N/A — não há operação de usuário.
- **Eventos/integrações disparados:** N/A.

---

## Erros

Não há código de erro HTTP. Os desfechos de falha do teste são estes.

| Desfecho | Quando | Mensagem |
| --- | --- | --- |
| Conexão recusada pela câmera | o certificado do servidor não encadeia na CA embutida | `websocket connect failed` |
| Quadro inválido | a mensagem recebida não começa com `FF D8` ou não termina com `FF D9` | `frame seq=<n> bytes=<n> valid=false` |
| Rede caída | o Wi-Fi desassocia | `wifi disconnected` |

## Efeitos Colaterais

- **Persistência:** nenhuma. Nem o firmware nem o servidor de bancada gravam o quadro.
- **Concorrência:** N/A — uma câmera, uma conexão.
- **Transação:** N/A.

---

## Cenários de Aceite (Gherkin)

### Cenário 1 — Conexão com o certificado da CA embutida (caminho feliz)

```gherkin
Dado que o servidor de bancada está de pé com `server.pem`
E o firmware foi gravado com `ca.pem` embutido
Quando a placa liga
Então o log serial traz `tls handshake_ms=<n>`
E o servidor de bancada registra o quadro 1 com `valid=true`
```

### Cenário 2 — Servidor assinado por outra CA (exceção)

```gherkin
Dado que o servidor de bancada está de pé com `other-server.pem`
E o firmware foi gravado com `ca.pem` embutido
Quando a placa liga
Então o log serial traz `websocket connect failed`
E o servidor de bancada não registra nenhum quadro
```

### Cenário 3 — Cem quadros com a memória estável (caminho feliz)

```gherkin
Dado que a conexão do Cenário 1 está aberta
Quando a placa envia os quadros 1 a 100, um a cada 2 s
Então o servidor de bancada registra 100 linhas com `valid=true`
E o log serial não traz reset nem falha de alocação
E `heap_after` do quadro 100 difere em no máximo 5% de `heap_after` do quadro 1
```

### Cenário 4 — Reconexão depois da queda de rede (caminho alternativo)

```gherkin
Dado que a placa já enviou o quadro 100
Quando o Wi-Fi é desligado por 60 s e religado, 3 vezes
Então o log serial traz `wifi disconnected` em cada queda
E traz 3 linhas `reconnected network_to_frame_ms=<n>` com `n` de no máximo 30000
E ninguém reinicia nem regrava a placa
```

### Cenário 5 — O ADR recebe o resultado

```gherkin
Dado que os Cenários 1 a 4 foram executados na placa real
Quando o resultado é registrado
Então o ADR 0007 traz a seção `Resultado do teste de bancada` com os números medidos
E o status dele é `accepted` se os quatro passaram, ou a decisão é HTTPS com consulta periódica se algum reprovou
```

---

## Impacto na arquitetura

- **Câmera** (`building-blocks/camera.md`): o caminho passa a `esp32-cam`; o framework passa a ESP-IDF;
  o estado deixa de ser "só um `.gitkeep`". Com o resultado, a seção "Para mudar com segurança" perde o
  aviso de canal `proposed`, ou o arquivo é reescrito para HTTPS com consulta periódica.
- **Riscos** (`risks.md`): a linha "O canal WebSocket sobre TLS não foi testado na ESP32-CAM real" sai
  com o resultado.
- **ADR 0007**: status e a seção de resultado, pela regra 6.
- **`AGENTS.md` da raiz**: a linha do firmware na tabela de stack e a linha `esp32-cam` na de comandos.
- **`esp32-cam/AGENTS.md`**: nasce com os gates da área e os comandos de certificado.
- **Proxy TLS**, **Serviço** e os cenários de runtime: sem mudança. O servidor de bancada não é bloco
  do mapa.

## Impacto no modelo de dados

N/A — o teste não cria nem lê tabela.

## Fora de Escopo

- Credencial da câmera e autenticação na conexão: épico #177.
- Comando de captura, finalidade, rota WebSocket em `apps/api` e cota: épico #178.
- Proxy TLS e a escolha da tecnologia dele: épico #178.
- Certificado público e o ambiente de nuvem: épico #179.
- Canal de comandos entre réplicas no Redis: épico #178.
- Latência da captura ao resultado e o orçamento de OQ-03: épico #179. O tempo de handshake medido aqui
  é um insumo, não a medida do artigo.
- Protótipo do plano B: se o teste reprovar, o ADR é reescrito e o HTTPS com consulta periódica é
  construído no épico #178.
- Teste automatizado do firmware: `esp32-cam` não tem runner, e o teste é a execução na placa.

## Quebra em Tasks

As duas são entregas da issue #181, um commit cada, na branch `chore/181-camera-channel-bench`. Não
viram sub-issues.

| # | Título | Escopo | Critério de aceite | Depende de |
| --- | --- | --- | --- | --- |
| 1 | Add the bench firmware and the bench server for the camera channel | `esp32-cam/` (projeto ESP-IDF: `CMakeLists.txt`, `sdkconfig.defaults`, `main/`), `esp32-cam/bench/server.py`, `esp32-cam/AGENTS.md`, `.gitignore`, linhas de stack e de comandos do `AGENTS.md` da raiz | `idf.py build` sem erro nem aviso; Cenários 1, 2, 3 e 4 executados na placa, com o log serial colado por Theo | — |
| 2 | Record the bench result in ADR 0007 | `docs/decisions/0007-canal-da-camera-por-websocket.md`, `docs/architecture/building-blocks/camera.md`, `docs/architecture/risks.md` | Cenário 5 | 1 |
