import type { NextConfig } from "next";
import "./src/shared/env/env";

const nextConfig: NextConfig = {
  // Each app in this repo is installed and built on its own (no root manifest),
  // so file tracing is rooted at the app itself. Without this, Next walks up
  // and can pick a stray lockfile outside the repository as the workspace root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
