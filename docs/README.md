# Documentação do Vultra

Cada pasta trata de um assunto e abre com um `README.md` que a indexa.

| Pasta | O que guarda |
| --- | --- |
| [requirements/](requirements/README.md) | O SRS versionado: requisitos, regras de negócio e questões abertas |
| [architecture/](architecture/README.md) | O mapa do sistema: blocos, cenários, implantação e conceitos transversais |
| [data-model/](data-model/README.md) | Entidades, relações e armazenamento |
| [roadmap/](roadmap/README.md) | Estágios, épicos, cobertura de requisitos e o plano de cada sprint |
| [decisions/](decisions/README.md) | ADRs: por que cada decisão transversal foi tomada |
| [specs/](specs/) | Especificações de funcionalidade. As três que existem descrevem o plano anterior ao SRS 1.0.0 |
| [research/](research/pre-registro.md) | Pré-registro do experimento do artigo |
| [diagrams/](diagrams/) | Diagramas `.drawio.svg`, editáveis no VS Code com a extensão `hediet.vscode-drawio` |
| [backend/adrs/](backend/adrs/README.md) · [database/adrs/](database/adrs/README.md) | ADRs anteriores a 2026-10-06 |

## Abrir o site local

A documentação é lida localmente, nunca publicada.

```
uvx zensical serve --open
```

O site sobe em `http://localhost:8000`. No VS Code, a tarefa `docs: serve` faz o mesmo.
