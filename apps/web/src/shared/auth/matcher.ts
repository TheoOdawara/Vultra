export const MIDDLEWARE_MATCHER = String.raw`/((?!_next/static|_next/image|favicon\.ico|manifest\.webmanifest|sw\.js|.*\..*).*)`;

const COMPILED = new RegExp(`^${MIDDLEWARE_MATCHER}$`);

export function runsMiddlewareOn(pathname: string): boolean {
  return COMPILED.test(pathname);
}
