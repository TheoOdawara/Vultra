# Proxy TLS

`infra/` · Caddy `2.11.7` · estágio E1 · ainda não existe; definido na [SPEC-007](../../specs/pipeline-de-inferencia-de-um-quadro.md).

## O que faz

É a única porta de entrada do compose. Termina o TLS e encaminha, pela rede interna, o tráfego das
câmeras e do gestor para o [Serviço](service.md) e, no E2, o do navegador para o [Painel](panel.md).

| Ambiente | Certificado |
| --- | --- |
| Nuvem | público |
| Local | emitido por uma CA própria, a mesma fixada no firmware da câmera |

## O que nunca faz

- Aceitar conexão sem TLS.
- Guardar corpo de requisição em log: o quadro passa por ele.

## Para mudar com segurança

- Precisa encaminhar WebSocket de longa duração sem derrubar a conexão ociosa da câmera.
- Nenhum outro contêiner publica porta no host.
- Ele descarta o `X-Forwarded-For` do cliente e grava o endereço real; a cota do login por IP depende
  disso (E1, SPEC-007).
- No E1 só o certificado da CA própria está configurado, em `infra/proxy/certs/`, fora do git. O
  certificado público é do épico #179.
