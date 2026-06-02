/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.

// Allow side-effect CSS imports in Next.js layouts and pages
declare module "*.css" {
  const styles: { readonly [key: string]: string };
  export default styles;
}
