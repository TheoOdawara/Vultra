---
name: hexagonal-arch
description: >-
  Aplicar ao criar ou reorganizar qualquer estrutura no api-core seguindo Clean
  Architecture: use cases (core/use-cases/), entidades e value objects de domínio
  (core/domain/), ports/interfaces (core/ports/), repositórios Drizzle
  (adapters/repositories/), adapters de fila (adapters/queue/), container de DI
  (infrastructure/container.ts), ou qualquer nova feature de negócio. Use esta
  skill sempre que criar um novo use case, uma nova camada de serviço, definir
  uma interface de repositório, ou precisar saber onde um arquivo deve ficar na
  estrutura de pastas do api-core.
---

# Arquitetura Hexagonal — API Core Vultra

## Overview

O api-core segue **Arquitetura Hexagonal (Clean Architecture)**. O domínio (`core/`) é completamente isolado — nunca importa de `adapters/` ou `infrastructure/`. Adapters implementam ports (interfaces) definidos no domínio. Use Cases têm um único método `execute`. Dependências são injetadas via `container.ts`.

---

## When to Use This Skill

- Criar um novo caso de uso de negócio
- Definir uma nova entidade ou value object de domínio
- Criar um port (interface) para um serviço externo
- Implementar um repositório Drizzle ou adapter de fila
- Registrar dependências no container de DI
- Criar um novo erro de domínio

---

## Quick Start

```typescript
// 1. Port (core/ports/IEventoRepository.ts)
export interface IEventoRepository {
  findById(id: string, organizationId: string): Promise<Evento | null>;
  create(data: NovoEvento): Promise<Evento>;
}

// 2. Use Case (core/use-cases/CriarEventoUseCase.ts)
export class CriarEventoUseCase {
  constructor(private readonly eventoRepo: IEventoRepository) {}
  async execute(input: CriarEventoInput): Promise<CriarEventoOutput> {
    // orquestração — sem Drizzle, sem HTTP, sem Redis aqui
    return this.eventoRepo.create({ ...input });
  }
}

// 3. Adapter (adapters/repositories/evento.repository.ts)
export class DrizzleEventoRepository implements IEventoRepository {
  constructor(private readonly db: Database) {}
  async create(data: NovoEvento) {
    const [row] = await withTenantContext(data.organizationId, (tx) =>
      tx.insert(schema.eventos).values(data).returning()
    );
    return row;
  }
}

// 4. Container (infrastructure/container.ts)
const eventoRepo = new DrizzleEventoRepository(db);
export const criarEventoUseCase = new CriarEventoUseCase(eventoRepo);
```

---

## Key Rules

| Regra | Motivo |
|-------|--------|
| `core/` **nunca** importa de `adapters/` ou `infrastructure/` | Lei de dependência da arquitetura hexagonal |
| Use Case tem apenas o método `execute(input): Promise<Output>` | Coesão — um caso de uso, uma responsabilidade |
| Adapters só são criados após definir o port (interface) | O contrato precede a implementação |
| Dependências injetadas via construtor — nunca instanciadas no Use Case | Inversão de controle, testabilidade |
| Erros de domínio extendem `DomainError` com `code` e `httpStatus` | Mapeamento central no `globalErrorHandler` |

---

## Resources

### references/
- [`structure.md`](./references/structure.md) — mapa completo de pastas, regras de importação por camada
- [`use-cases.md`](./references/use-cases.md) — contrato de Use Case, DTOs de Input/Output, exemplos
- [`ports-adapters.md`](./references/ports-adapters.md) — interfaces de port, implementação de repositório
- [`domain-errors.md`](./references/domain-errors.md) — `DomainError`, subclasses, códigos e `httpStatus`
- [`container.md`](./references/container.md) — padrão de injeção de dependências no `container.ts`

### Arquivos do projeto
- [`apps/api-core/src/`](../../../apps/api-core/src/)
- [`docs/backend/arquitetura/hexagonal.md`](../../../docs/backend/arquitetura/hexagonal.md)
- [`docs/backend/guias/convencoes.md`](../../../docs/backend/guias/convencoes.md)
