# esp32-cam

O firmware da câmera. Soma-se ao `AGENTS.md` da raiz e não o contradiz.

## Estado real

Existe só o firmware de bancada da
[SPEC-005](../docs/specs/teste-de-bancada-do-canal-da-camera.md) e o servidor de bancada. A placa
conecta ao Wi-Fi, abre `wss://` validando o servidor contra a CA embutida e envia um quadro VGA em JPEG
a cada 2 s. Não há credencial, comando de captura nem finalidade. Os Cenários 1, 2 e 3 da spec
foram executados na placa real, com os números no ADR 0007; o Cenário 4, a reconexão após queda de rede, é a issue #193.

## Stack

AI-Thinker ESP32-CAM, com OV2640 e PSRAM. ESP-IDF v6.1, instalado fora do repositório com o `eim`
(`winget install Espressif.EIM-CLI`, depois `eim install -i v6.1 -t esp32`). C++ sobre a API em C do
ESP-IDF. As dependências ficam em `main/idf_component.yml`, com versão exata, e o
`dependencies.lock` é versionado.

O servidor de bancada é um único arquivo Python, sem projeto `uv`: a dependência entra na linha de
comando.

## Comandos

Todos dentro de `esp32-cam`. O ESP-IDF é ativado uma vez por terminal PowerShell:

```
. C:\Espressif\tools\Microsoft.v6.1.PowerShell_profile.ps1
idf.py build
```

O servidor de bancada e os gates dele:

```
uv run --no-project --with websockets==17.2 bench/server.py --cert bench/certs/server.pem --key bench/certs/server.key
uvx ruff check bench/server.py
uvx ruff format --check bench/server.py
```

`esp32-cam` não tem runner de teste: o teste é a execução na placa, cenário por cenário da SPEC-005.

## Certificados de bancada

`bench/certs/` fica fora do git e precisa existir antes do build, porque `ca.pem` é embutido no
firmware. Os comandos rodam dentro de `bench/certs`, com o IP da máquina que sobe o servidor no lugar
de `<ip>`:

```
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 365 -subj "/CN=Vultra bench CA" -addext "keyUsage=critical,keyCertSign,cRLSign" -keyout ca.key -out ca.pem
openssl req -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -subj "/CN=<ip>" -addext "subjectAltName=IP:<ip>" -keyout server.key -out server.csr
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -days 365 -copy_extensions copy -out server.pem
```

O caso negativo repete os três comandos trocando `ca` por `other-ca`, `server` por `other-server` e o
nome da CA.

## Bancada

1. `idf.py menuconfig`, menu `Vultra camera bench`: `BENCH_WIFI_SSID`, `BENCH_WIFI_PASSWORD` e
   `BENCH_SERVER_URI` (`wss://<ip>:8443/`). O build falha enquanto uma delas estiver vazia.
2. Porta 8443 de entrada liberada no firewall da máquina do servidor.
3. Servidor de pé, depois `idf.py -p <porta> flash monitor`.

O `sdkconfig` gerado guarda a senha do Wi-Fi e não é versionado.

## Arquitetura

```
main/main.cpp            Wi-Fi, câmera, canal WebSocket e o laço de envio
main/Kconfig.projbuild   as três opções de bancada, sem valor padrão
main/idf_component.yml   as dependências do gerenciador de componentes
sdkconfig.defaults       alvo, flash de 4 MB, partição de app único grande e PSRAM
bench/server.py          o servidor de bancada: uma linha por quadro, nada em disco
```

Um arquivo só enquanto o firmware for de bancada. Uma responsabilidade vira arquivo próprio quando o
firmware real lhe der consumidor ou ciclo de vida separado.

## Convenções

- Pino e periférico que o nosso código aciona são escritos direto no registrador (`GPIO.enable_w1ts`,
  `GPIO.out_w1ts`, `GPIO.out_w1tc`, de `soc/gpio_struct.h`), não pela API de driver. Biblioteca só onde
  ela é dona do periférico: Wi-Fi, TLS, WebSocket e a câmera. O firmware de bancada ainda não aciona
  nenhum pino.
- A validação do certificado e do nome do servidor nunca é desligada: nenhuma opção
  `skip_cert_common_name_check` nem cliente sem `cert_pem`.
- O quadro não é gravado na flash nem no cartão SD.

## Gotchas

- O ESP-IDF v6.1 emite cinco `CMake Warning` de `component_validation.cmake` sobre `wpa_supplicant` e
  `esp_wifi`, componentes dele. Não há opção que os desligue. O gate é zero aviso do compilador.
- Com o servidor de bancada fora do ar, a placa registra `ESP_ERR_ESP_TLS_CONNECTION_TIMEOUT`, não
  conexão recusada: o firewall do Windows descarta em silêncio o que chega a uma porta sem ouvinte.
- Com a câmera ligada, o rádio da placa perde margem. A -65 dBm ou pior, o canal quase não entrega
  quadro (aberturas de 5 a 16 s, envios estourando o tempo, `bcn_timeout`); a -57 dBm entrega um quadro
  a cada 2 s sem falha. Sem a câmera, o mesmo enlace fraco funciona. A linha `wifi connected rssi=`
  do boot diz em qual caso a placa está, e num mesh a placa só entra no nó cujo nome foi configurado.
- No Git Bash, o `-subj "/CN=..."` do `openssl` é convertido em caminho do Windows. Os comandos de
  certificado rodam com `MSYS_NO_PATHCONV=1`.
- O Python 3.13 recusa uma CA sem `keyUsage`, daí o `-addext` no comando da CA.
- A extensão CMake Tools do VS Code grava `cmake.sourceDirectory` com caminho absoluto em
  `.vscode/settings.json` ao ver o `CMakeLists.txt`. Essa linha não é commitada.
