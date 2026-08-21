/**
 * VULTRA API Core — Entry Point
 *
 * Starts the ElysiaJS server via Bun.serve.
 * All composition happens in infrastructure/server.ts.
 */

import { app } from "./infrastructure/server";
import { env } from "./shared/infra/env/env.ts";

app.listen(env.port);

export type App = typeof app;
