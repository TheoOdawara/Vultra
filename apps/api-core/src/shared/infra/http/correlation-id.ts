export const CORRELATION_ID_HEADER = "X-Correlation-Id";

const ACCEPTED_VERSIONS =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assigned = new WeakMap<Request, string>();

export function isCorrelationId(candidate: string): boolean {
  return ACCEPTED_VERSIONS.test(candidate);
}

export function correlationIdOf(request: Request): string {
  const alreadyAssigned = assigned.get(request);
  if (alreadyAssigned !== undefined) {
    return alreadyAssigned;
  }

  const offered = request.headers.get(CORRELATION_ID_HEADER);
  const resolved = offered !== null && isCorrelationId(offered) ? offered : crypto.randomUUID();
  assigned.set(request, resolved);

  return resolved;
}
