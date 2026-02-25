# ADR-001 — TypeBox como Biblioteca de Validação

> **Status:** Aceito  
> **Data:** Fevereiro 2026  
> **Contexto:** Backend API Core (ElysiaJS)

---

## Contexto

O VULTRA precisa de validação de schemas em runtime para garantir a integridade dos dados recebidos nas rotas HTTP. As opções avaliadas foram: **TypeBox**, **Zod**, **Joi** e **Valibot**.

---

## Decisão

**TypeBox** foi adotado como única biblioteca de validação do projeto.

---

## Justificativa

| Critério | TypeBox | Zod | Joi |
|----------|:-------:|:---:|:---:|
| Integração nativa ElysiaJS | ✅ | ❌ | ❌ |
| Zero overhead de runtime (schemas são JSON Schema padrão) | ✅ | ❌ | ❌ |
| Tipos TypeScript inferidos automaticamente | ✅ | ✅ | ❌ |
| Compatível com `t.Object()` inline nas rotas Elysia | ✅ | ❌ | ❌ |

O ElysiaJS usa TypeBox internamente como motor de validação e inferência de tipos. Usar outra biblioteca cria uma camada de tradução desnecessária e perde todos os benefícios de type-safety end-to-end do Eden Treaty.

---

## Consequências

- **Positivas:** Validação com zero custo adicional, tipos TypeScript inferidos nas rotas, schemas reutilizáveis como JSON Schema em outros contextos (ex: documentação OpenAPI).
- **Negativas:** A API de TypeBox é mais verbosa que Zod para alguns casos (ex: refinements complexos).
- **Restrição:** Zod, Joi e Yup são **proibidos** no projeto. Qualquer PR que inclua essas dependências deve ser rejeitado.
