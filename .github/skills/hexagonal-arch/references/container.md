# Container de DI — `infrastructure/container.ts`

O container instancia todas as dependências e exporta os Use Cases prontos para as rotas.

```typescript
// infrastructure/container.ts
import { db }                              from './database/client';
import { redis }                           from './redis';

// Adapters — implementam os ports
import { DrizzleMemberRepository }         from '../adapters/repositories/member.repository';
import { DrizzleBiometricRepository }      from '../adapters/repositories/biometric.repository';
import { DrizzleAttendanceRepository }     from '../adapters/repositories/attendance.repository';
import { DrizzleDeviceRepository }         from '../adapters/repositories/device.repository';
import { RedisAIJobQueue }                 from '../adapters/queue/AIJobQueue';
import { DrizzleAuditLogRepository }       from '../adapters/repositories/audit-log.repository';

// Use Cases
import { RecordAttendanceUseCase }         from '../core/use-cases/RecordAttendanceUseCase';
import { EnrollBiometricUseCase }          from '../core/use-cases/EnrollBiometricUseCase';
import { OpenAttendanceSessionUseCase }    from '../core/use-cases/OpenAttendanceSessionUseCase';
import { CloseAttendanceSessionUseCase }   from '../core/use-cases/CloseAttendanceSessionUseCase';
import { GenerateReportUseCase }           from '../core/use-cases/GenerateReportUseCase';

// ─── Instanciar Adapters ───────────────────────────────────────────────────────
const memberRepo      = new DrizzleMemberRepository(db);
const biometricRepo   = new DrizzleBiometricRepository(db);
const attendanceRepo  = new DrizzleAttendanceRepository(db);
const deviceRepo      = new DrizzleDeviceRepository(db);
const auditLogRepo    = new DrizzleAuditLogRepository(db);
const aiQueue         = new RedisAIJobQueue(redis);

// ─── Instanciar Use Cases (exportados para as rotas) ──────────────────────────
export const recordAttendanceUseCase      = new RecordAttendanceUseCase(biometricRepo, attendanceRepo, aiQueue);
export const enrollBiometricUseCase       = new EnrollBiometricUseCase(biometricRepo, memberRepo, aiQueue);
export const openAttendanceSessionUseCase = new OpenAttendanceSessionUseCase(attendanceRepo, deviceRepo);
export const closeAttendanceSessionUseCase = new CloseAttendanceSessionUseCase(attendanceRepo);
export const generateReportUseCase        = new GenerateReportUseCase(attendanceRepo, memberRepo);
```

---

## Uso nas Rotas

```typescript
// adapters/http/routes/attendance.routes.ts
import { recordAttendanceUseCase } from '../../../infrastructure/container';

export const attendanceRoutes = new Elysia({ prefix: '/v1/attendance' })
  .use(withAuth)
  .post('/record',
    ({ body, currentOrg }) => recordAttendanceUseCase.execute({ ...body, organizationId: currentOrg }),
    { body: RecordAttendanceBodySchema }
  );
```

---

## Regras do Container

- O container é o **único lugar** onde dependências são instanciadas
- Use Cases **nunca** importam o container (inversão circular)
- Rotas importam apenas os Use Cases necessários, não o container inteiro
- Para testes, substituir o adapter pelo mock no construtor do Use Case
