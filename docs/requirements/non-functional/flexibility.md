# FLEX — Flexibilidade

Onde o sistema precisa conseguir rodar.

<a id="nfr-flex-01"></a>
## NFR-FLEX-01 — Mesmos artefatos em dois ambientes

O sistema deve rodar em uma máquina local na rede da câmera e em um servidor na nuvem a partir dos
mesmos artefatos de build, diferindo apenas na configuração.

| Atributo | Valor |
| --- | --- |
| Rationale | Mede-se no ambiente local e demonstra-se na nuvem; duas bases de código tornariam a medição alheia ao que é demonstrado |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **NFR-FLEX-01.1** — Dado um mesmo conjunto de artefatos de build, quando ele é implantado nos dois
  ambientes, então o fluxo do núcleo funciona de ponta a ponta em ambos com 0 alterações de código.
