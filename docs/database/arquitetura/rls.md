# 🔐 Row-Level Security (RLS)

> **← [Voltar ao Database](../README.md)**

---

## Objetivo

O RLS garante que, mesmo que uma query esqueça o filtro `organization_id`, o banco de dados **nunca retorne dados de outro tenant**. É a última linha de defesa contra vazamento de dados multitenant.

---

## Configuração do Contexto por Requisição

O `organization_id` do tenant ativo deve ser injetado como variável de sessão PostgreSQL no **início de cada request autenticado**:

```sql
SELECT set_config('app.current_org_id', $orgId, TRUE);
-- TRUE = válido apenas para a transação atual, não persiste
```

Isso permite que as políticas de RLS filtrem automaticamente sem necessidade de cláusulas manuais em todas as queries.

> **Onde implementar:** No adapter de repositório (`adapters/repositories/`), **não** nos Use Cases. O Use Case não deve saber que RLS existe.

---

## Tabelas com RLS Obrigatório

| Tabela | Tipo de Política |
|--------|-----------------|
| `biometric_profiles` | ROW READ/WRITE — `organization_id = current_setting('app.current_org_id')::uuid` |
| `attendance_records` | ROW READ/WRITE — idem |
| `attendance_sessions` | ROW READ/WRITE — idem |
| `members` | ROW READ/WRITE — idem |

---

## Exceções

| Tabela | Motivo da Exceção |
|--------|-----------------|
| `organizations` | Lida no nível de super-admin — política separada por role |
| `audit_logs` | Somente inserção — SELECT é restrito por aplicação, não por RLS |
| `devices` | Incluída na lista — RLS padrão aplicado |

---

## Testando RLS

Para verificar que o RLS está funcionando, testar as seguintes condições:

1. Sem `set_config` → query deve retornar zero linhas (ou erro, conforme configuração de `FORCE ROW LEVEL SECURITY`)
2. Com `set_config` de org A → queries retornam apenas dados da org A
3. Com `set_config` de org A → tentativa de INSERT com `organization_id` da org B deve ser bloqueada pela política
