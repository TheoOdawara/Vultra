/**
 * VULTRA — GetWellbeingReportUseCase
 *
 * GET /v1/reports/wellbeing
 * Returns sentiment distribution and alerts for HR-level wellbeing monitoring.
 *
 * LGPD note: Only aggregated data is returned — no individual frame or embedding
 * is accessible through this endpoint. Raw sentiment labels were already
 * derived from anonymised inference at record time.
 */

import type {
  IReportsRepository,
  WellbeingAlert,
  WellbeingReportFilter,
  WellbeingReportRow,
} from "../../ports/IReportsRepository";
import { InvalidReportRangeError } from "./GetAttendanceReportUseCase";

export interface GetWellbeingReportInput {
  organizationId: string;
  from: Date;
  to: Date;
  /** Min negative-sentiment count to surface in alerts (default: 3) */
  alertThreshold?: number;
}

export interface GetWellbeingReportOutput {
  sentimentBreakdown: WellbeingReportRow[];
  alerts: WellbeingAlert[];
  generatedAt: Date;
  filter: {
    from: string;
    to: string;
    alertThreshold: number;
  };
}

export class GetWellbeingReportUseCase {
  constructor(private readonly reportsRepo: IReportsRepository) {}

  async execute(input: GetWellbeingReportInput): Promise<GetWellbeingReportOutput> {
    if (input.from >= input.to) throw new InvalidReportRangeError();

    const threshold = input.alertThreshold ?? 3;

    const filter: WellbeingReportFilter = {
      organizationId: input.organizationId,
      from: input.from,
      to: input.to,
      alertThreshold: threshold,
    };

    const [sentimentBreakdown, alerts] = await Promise.all([
      this.reportsRepo.getWellbeingReport(filter),
      this.reportsRepo.getWellbeingAlerts(filter),
    ]);

    return {
      sentimentBreakdown,
      alerts,
      generatedAt: new Date(),
      filter: {
        from: input.from.toISOString(),
        to: input.to.toISOString(),
        alertThreshold: threshold,
      },
    };
  }
}
