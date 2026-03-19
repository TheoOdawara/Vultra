# Use Cases — Contrato, DTOs e Exemplos

## Contrato Obrigatório

Todo Use Case tem **exatamente** um método público: `execute(input: Input): Promise<Output>`.

```typescript
// core/use-cases/RecordAttendanceUseCase.ts
import type { IBiometricRepository }  from '../ports/IBiometricRepository';
import type { IAttendanceRepository } from '../ports/IAttendanceRepository';
import type { IAIQueueAdapter }       from '../ports/IAIQueueAdapter';
import { AttendanceConflictError }    from '../domain/errors/AttendanceConflictError';
import { FaceNotRecognizedError }     from '../domain/errors/FaceNotRecognizedError';

// DTOs — tipos simples, sem dependência de Drizzle ou TypeBox
interface RecordAttendanceInput {
  sessionId:      string;
  frameBase64:    string;
  organizationId: string;
  deviceId:       string;
}

interface RecordAttendanceOutput {
  recordId:        string;
  confidenceScore: number;
  sentimentLabel?: string;
  recordedAt:      Date;
}

export class RecordAttendanceUseCase {
  constructor(
    private readonly biometricRepo: IBiometricRepository,
    private readonly attendanceRepo: IAttendanceRepository,
    private readonly aiQueue:        IAIQueueAdapter,
  ) {}

  async execute(input: RecordAttendanceInput): Promise<RecordAttendanceOutput> {
    // 1. Enfileira frame → AI Service gera embedding + sentimento
    const aiResult = await this.aiQueue.processFrame({
      frameBase64:    input.frameBase64,
      organizationId: input.organizationId,
    });

    // 2. Busca membro por similaridade cosseno
    const match = await this.biometricRepo.findByEmbedding(
      aiResult.embedding,
      input.organizationId,
    );
    if (!match) throw new FaceNotRecognizedError();

    // 3. Verifica duplicata → HTTP 409 se já registrado na sessão
    const isDuplicate = await this.attendanceRepo.existsInSession(
      input.sessionId,
      match.memberId,
    );
    if (isDuplicate) throw new AttendanceConflictError(match.memberId, input.sessionId);

    // 4. Persiste (sem imagem — apenas scores)
    return this.attendanceRepo.create({
      sessionId:       input.sessionId,
      memberId:        match.memberId,
      organizationId:  input.organizationId,
      confidenceScore: match.similarity,
      sentimentLabel:  aiResult.sentiment?.label,
    });
  }
}
```

---

## DTOs — Regras

- DTOs são `interface` TypeScript puro — sem dependência de Drizzle, TypeBox ou outras libs
- `Input` contém apenas o que o handler passa — **sem `organizationId` opcional** (sempre obrigatório)
- `Output` é o que a rota HTTP retorna — pode ser derivado de `$inferSelect` mas não é o tipo Drizzle diretamente
- Nomear como `[Acao]Input` e `[Acao]Output` no mesmo arquivo do Use Case

---

## Use Cases Existentes no Vultra

| Use Case | Responsabilidade |
|----------|-----------------|
| `RecordAttendanceUseCase` | Frame ESP32 → embedding → match → registro de presença |
| `EnrollBiometricUseCase` | Cadastro de embedding facial de membro |
| `OpenAttendanceSessionUseCase` | Abre sessão de chamada |
| `CloseAttendanceSessionUseCase` | Encerra sessão e calcula estatísticas |
| `GenerateReportUseCase` | Gera relatório de presença por período |
