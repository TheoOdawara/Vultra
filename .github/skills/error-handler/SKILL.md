---
name: error-handler
description: >-
  Aplicar ao criar novos erros de domínio (DomainError), modificar o
  globalErrorHandler ElysiaJS, mapear novos códigos de erro para HTTP status
  semântico, debugar respostas de erro inconsistentes, ou adicionar logging/
  auditoria de erros no Vultra. Use esta skill sempre que precisar lançar um erro
  em use cases ou adapters, criar uma nova subclasse de DomainError com code e
  httpStatus, ou garantir que o globalErrorHandler seja o primeiro plugin em
  server.ts.
---

# Error Handler

Sistema centralizado de tratamento de erros do Vultra. Erros de domínio (`DomainError`) são lançados em qualquer camada e capturados pelo `globalErrorHandler` ElysiaJS, que os mapeia para respostas HTTP semânticas.

## When to Use This Skill

- Criar novos tipos de erro de domínio
- Modificar mapeamentos de código de erro para HTTP status
- Registrar o `globalErrorHandler` em `server.ts`
- Debugar respostas de erro inconsistentes ou sem corpo estruturado
- Adicionar logging/auditoria de erros

## Quick Start

```typescript
// 1. Lançar em qualquer camada (use case, adapter, middleware)
throw new AttendanceConflictError(); // → 409 automaticamente

// 2. globalErrorHandler captura em server.ts
import Elysia from 'elysia';
import { DomainError } from '../core/errors';

export const globalErrorHandler = new Elysia({ name: 'globalErrorHandler' })
  .onError(({ error, set }) => {
    if (error instanceof DomainError) {
      set.status = error.httpStatus;
      return { error: error.code, message: error.message };
    }
    // Erros inesperados → 500 (não vazar stack trace)
    set.status = 500;
    return { error: 'INTERNAL_ERROR', message: 'Internal server error' };
  });
```

## Key Rules

| Regra | Motivo |
|-------|--------|
| `globalErrorHandler` PRIMEIRO plugin em `server.ts` | ElysiaJS — plugins registrados antes capturam erros de plugins posteriores |
| Nunca retornar stack trace em produção | Segurança — não vazar detalhes de implementação |
| Usar `error.code` (string) no corpo | Clientes podem fazer branch por código sem depender de mensagem |
| Erros inesperados → sempre 500 genérico | Não vazar informações internas (SQL errors, paths, etc.) |
| `DomainError` como base de todos os erros | Polimorfismo — `instanceof DomainError` captura toda a hierarquia |

## Resources

- [Classes de DomainError e hierarquia de erros](references/domain-errors.md)
- [Tabela de códigos HTTP semânticos por erro](references/http-codes.md)
- [Docs error handler](../../../docs/backend/manuais/error-handler.md)
- [globalErrorHandler em contexto de bootstrap](../elysia-typebox/references/bootstrap.md)
