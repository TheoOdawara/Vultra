# Bootstrap — `server.ts` e Ordem dos Plugins

## Ordem Obrigatória de Montagem

```typescript
// infrastructure/server.ts
import Elysia from 'elysia';
import { globalErrorHandler }  from '../adapters/http/middleware/global-error.middleware';
import { attendanceRoutes }    from '../adapters/http/routes/attendance.routes';
import { memberRoutes }        from '../adapters/http/routes/member.routes';
import { deviceRoutes }        from '../adapters/http/routes/device.routes';
import { biometricRoutes }     from '../adapters/http/routes/biometric.routes';
import { reportRoutes }        from '../adapters/http/routes/report.routes';
import { healthRoutes }        from '../adapters/http/routes/health.routes';
import { iotRoutes }           from '../adapters/http/routes/iot.routes';

export const app = new Elysia()
  .use(globalErrorHandler)   // 1º — deve ser o primeiro, captura erros de todos os handlers abaixo
  .use(attendanceRoutes)     // /v1/attendance — withAuth interno
  .use(memberRoutes)         // /v1/members
  .use(deviceRoutes)         // /v1/devices
  .use(biometricRoutes)      // /v1/biometric
  .use(reportRoutes)         // /v1/reports
  .use(healthRoutes)         // /v1/health — público
  .use(iotRoutes)            // /v1/iot — withDeviceAuth interno
  .listen(process.env['PORT'] ?? 3000);
```

**Por que `globalErrorHandler` precisa ser o primeiro:**

No ElysiaJS, `onError` captura apenas rotas registradas **após** ele. Se for registrado depois das rotas, erros de handlers já registrados não serão capturados.

---

## Encapsulamento de `derive`

O `derive` tem escopo `local` por padrão — só afeta a instância onde foi definido e seus descendants. Isso significa que cada grupo de rotas pode ter seu próprio `derive` sem vazar contexto entre eles.

```typescript
// attendanceRoutes tem withAuth na instância
// iotRoutes tem withDeviceAuth na instância
// Nenhum middleware vaza para o outro
```

---

## Variáveis de Ambiente

```bash
PORT=3000
DATABASE_URL=postgres://user:pass@postgres:5432/vultra
REDIS_URL=redis://redis:6379
BETTER_AUTH_SECRET=$(openssl rand -base64 64)
BETTER_AUTH_URL=http://localhost:3000
NODE_ENV=development
```
