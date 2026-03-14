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
applyTo: "<glob do(s) arquivo(s) ou pasta(s) onde essa skill se aplica>"
description: >-
  Uma linha explicando quando o agente deve usar essa skill.
  Sê específico sobre o domínio técnico coberto.
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

## Frontmatter: `applyTo`

O campo `applyTo` define **quando o VS Code aplica a skill automaticamente**. Use globs do workspace relativos à raiz:

```yaml
# Skill aplicada a qualquer arquivo no database/
applyTo: "apps/api-core/src/infrastructure/database/**"

# Skill aplicada a múltiplas pastas
applyTo: >
  apps/api-core/src/adapters/http/**,
  apps/api-core/src/adapters/http/routes/**
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
| Sempre incluir frontmatter `applyTo` | O VS Code precisa saber quando aplicar a skill |
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

4. **LÓGICA DE PENSAMENTO (CoT)**: Force o agente a pensar antes de responder (Ex: "Analise o problema > Identifique os riscos > Proponha a solução").
5. **VALIDAÇÃO**: Defina como a resposta deve ser validada antes de ser entregue ao usuário.

## OUTPUT ESPERADO:
Forneça o prompt da nova skill dentro de um bloco de código Markdown, organizado com headers (#, ##) e bullet points para máxima legibilidade.


