# Proxy TLS

`infra/` · tecnologia a escolher na spec de infraestrutura do E1 · ainda não existe.

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
