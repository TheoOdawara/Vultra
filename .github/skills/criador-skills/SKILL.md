---
name: criador-skills
description: >-
  Aplicar ao criar uma nova skill para o projeto Vultra, atualizar uma skill
  existente que está desatualizada ou incorreta, ou quando uma área do código
  está gerando respostas genéricas demais. Use esta skill sempre que o usuário
  pedir para "criar uma skill", "adicionar skill", "documentar um padrão como
  skill", ou quando uma nova tecnologia/padrão adotado precisa ser ensinado ao
  agente no contexto específico do Vultra.
---

# Criador de Skills — Vultra

## Overview

Skills são arquivos Markdown que ensinam o agente a trabalhar em uma área específica do projeto. Uma boa skill é um **documento de referência prático e orientado a código** — não um prompt de persona. O agente já sabe programar; a skill fornece o *conhecimento específico do projeto* que ele não tem de outra forma.

O modelo de referência é a skill [`elysiajs/SKILL.md`](../elysiajs/SKILL.md), que equilibra exemplos concretos, regras claras e organização topical.

---

## When to Use This Skill

- O usuário pede para criar uma nova skill para o projeto
- Uma área do código está gerando respostas incorretas ou genéricas demais
- Uma nova tecnologia ou padrão foi adotado e precisa ser documentado como skill
- Uma skill existente está desatualizada ou seguindo um padrão errado

---

## Princípios de uma Skill Eficiente

**Seja um documento de referência, não um prompt de persona.**

| Faça | Evite |
|------|-------|
| Seções topicais com código imediato | Cabeçalhos como `## IDENTIDADE` ou `## MISSÃO` |
| Regras simples em tabela | Chains of thought longas ("Pense antes de responder...") |
| Quick Start funcional | "Anti-alucinação: diga [DADO NÃO LOCALIZADO]" |
| Resources apontando para arquivos do projeto | Output schemas rígidos como se o agente fosse uma API |
| Exemplos copy-pasteable | Explicações teóricas sem código |

---

## Template de Skill

```markdown
---
name: "<nome-da-skill>"
description: >-
  Uma linha explicando quando o agente deve usar essa skill.
  Seja específico e "empurre" o agente a usar a skill — liste termos-gatilho
  como "sempre que mencionar X, Y ou Z".
---

# [Nome da Tecnologia/Padrão] — Vultra

## Overview

1-2 frases sobre o que essa skill cobre e qual problema resolve no projeto.

---

## When to Use This Skill

Ative esta skill quando o usuário pedir para:
- [trigger 1 — específico e acionável]
- [trigger 2]
- [trigger 3]

---

## Quick Start

[Menor exemplo funcional que cobre o caso de uso principal]

\`\`\`typescript
// código funcional mínimo
\`\`\`

---

## [Tópico Principal 1]

[Explicação breve + código]

---

## [Tópico Principal 2]

[Explicação breve + código]

---

## Key Rules

| Regra | Motivo |
|-------|--------|
| [o que fazer ou não fazer] | [por que — em uma frase] |

---

## Resources

- [`docs/caminho/relevante.md`](../../../docs/caminho/relevante.md) — [o que contém]
- [`apps/api-core/src/caminho/`](../../../apps/api-core/src/caminho/) — [o que contém]
```

---

## Frontmatter: `name` e `description`

O campo `name` é o identificador da skill (deve coincidir com o nome da pasta). O campo `description` é o **principal mecanismo de trigger** — o agente decide se usa a skill com base nele. Seja específico e "empurre":

```yaml
# Skill com trigger amplo e específico
name: "minha-skill"
description: >-
  Aplicar ao criar X ou Y no projeto. Use esta skill sempre que
  mencionar [termo-A], [termo-B], ou [contexto-C].
```

---

## Onde Criar Skills

```
.agents/skills/
├── drizzle-orm.md          ← skill única em arquivo plano
├── elysia-typebox.md
└── elysiajs/               ← skill com sub-arquivos de referência
    ├── SKILL.md            ← entry point (obrigatório)
    ├── examples/
    └── references/
```

Use a estrutura com subpasta quando a skill precisar de arquivos de referência extensos (ex: exemplos de código, integrações, guias de deployment). Para a maioria dos casos, um único `.md` é suficiente.

---

## Key Rules

| Regra | Motivo |
|-------|--------|
| Sempre incluir frontmatter `name:` e `description:` | O agente precisa do `name` para identificar a skill e do `description` para saber quando usá-la |
| Registar a skill no `skills-lock.json` (raiz) | Obrigatório — controle de integridade do ecossistema |
| Código funcional copy-pasteable | O agente usa literalmente os exemplos |
| Seções curtas e focadas | Skills longas perdem efetividade — divida em skills menores |
| Referenciar arquivos reais do projeto | Ancora o agente na realidade do codebase |
| Nenhuma seção `## IDENTIDADE` ou `## MISSÃO` | A skill é um documento, não um prompt de persona |

---

## Registando no `skills-lock.json`

Após criar a skill, adicionar entrada em [`skills-lock.json`](../../../skills-lock.json):

```json
"<nome-da-skill>": {
  "source": ".agents/skills/<nome-da-skill>",
  "sourceType": "local",
  "computedHash": "<sha256sum do SKILL.md>"
}
```

Para obter o hash:
```bash
sha256sum .agents/skills/<nome-da-skill>/SKILL.md | cut -d' ' -f1
```

---

## Resources

- [`elysiajs/SKILL.md`](../elysiajs/SKILL.md) — modelo de referência de skill bem estruturada
- [`skills-lock.json`](../../../skills-lock.json) — registrar após criar cada skill
- [`docs/README.md`](../../../docs/README.md) — hub de documentação do Vultra
- `.github/copilot-instructions.md` — instruções globais do projeto
