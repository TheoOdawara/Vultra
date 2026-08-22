export type RequestIdentity = {
  readonly userId: string;
  readonly organizationId: string | null;
  readonly role: string | null;
};

const identities = new WeakMap<Request, RequestIdentity>();

export function rememberRequestIdentity(request: Request, identity: RequestIdentity): void {
  identities.set(request, identity);
}

export function requestIdentityOf(request: Request): RequestIdentity | null {
  return identities.get(request) ?? null;
}
