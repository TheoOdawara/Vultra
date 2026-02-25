# 📋 Convenções de Nomenclatura

> **← [Voltar ao Backend](../README.md)**

---

## Arquivos e Classes

| Item | Convenção | Exemplo |
|------|-----------|---------|
| Arquivos TypeScript | `kebab-case` | `attendance.routes.ts` |
| Classes | `PascalCase` | `RecordAttendanceUseCase` |
| Interfaces | `I` + `PascalCase` | `IBiometricRepository` |
| Enums | `SCREAMING_SNAKE_CASE` | `ATTENDANCE_STATUS.CONFIRMED` |
| Variáveis e funções | `camelCase` | `confidenceScore`, `findBySimilarity()` |
| Colunas de banco | `snake_case` | `organization_id`, `face_embedding` |
| Rotas HTTP | `kebab-case` | `/v1/attendance-sessions` |
| Arquivos Python | `snake_case` | `face_service.py`, `embedding_worker.py` |
| Classes Python | `PascalCase` | `FaceService`, `EmbeddingWorker` |

---

## Use Cases

- Sempre sufixar com `UseCase`: `RecordAttendanceUseCase`, `EnrollBiometricUseCase`
- Um arquivo por Use Case: `RecordAttendanceUseCase.ts`
- Método único público: `execute(input: XxxInput): Promise<XxxOutput>`

---

## Ports (Interfaces)

- Prefixo `I`: `IAttendanceRepository`, `IAIQueueAdapter`
- Ficam em `core/ports/` — sem dependências externas
- A implementação concreta fica em `adapters/repositories/` ou `adapters/queue/`

---

## Schemas TypeBox

- Sufixo `Schema`: `CreateAttendanceRecordSchema`, `DeviceAuthSchema`
- Ficam em `adapters/http/schemas/`
- Agrupados por recurso: `attendance.schema.ts` exporta múltiplos schemas do domínio de presenças

---

## Migrations

| Item | Convenção |
|------|-----------|
| Nome do arquivo | `NNN_descricao_curta.sql` |
| Exemplo | `003_create_biometric_profiles.sql` |
| Numeração | Sequencial, sem gaps, zero-padded (3 dígitos) |
| Estrutura | Sempre incluir `-- UP` e `-- DOWN` |
