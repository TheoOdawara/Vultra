# TODO: Fix Import Errors in api-core

**Approved Plan Steps:**

## 1. Fix Import Paths ✓ (Complete)
- [x] apps/api-core/src/adapters/http/attendance.routes.ts - Fix AIJobQueue import  
- [x] apps/api-core/src/adapters/http/biometric.routes.ts - Fix AIJobQueue import
- [x] apps/api-core/src/adapters/http/health.routes.ts - Fix AIJobQueue import
- [x] apps/api-core/src/infrastructure/server.ts - Add .ts to ai-job.queue import
- [x] apps/api-core/src/core/use-cases/attendance.use-cases.ts - Add .ts to repo imports
- [x] apps/api-core/src/core/use-cases/biometrics.use-cases.ts - Add .ts to repo imports

## 2. Install Dependencies & Lint (In Progress)
- [ ] cd apps/api-core && bun install 
- [ ] cd apps/api-core && bun biome check src --write

## 3. Fix TS Config (Complete) 
- [x] apps/api-core/tsconfig.json - Added DOM/node types

## 4. Fix TypeScript Strict Errors
- [ ] Handler params 'any' types (elysia context)
- [ ] exactOptionalPropertyTypes issues

## 5. Python Deps
- [ ] cd apps/ai-service && uv sync / pip install -e .

## 6. Test Startup
- [ ] cd apps/api-core && bun run src/main.ts

**Progress: Import paths fixed. Run `bun install` in apps/api-core to resolve module errors, then biome lint.**

