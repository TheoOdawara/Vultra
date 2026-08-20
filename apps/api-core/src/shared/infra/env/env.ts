import { readEnvironment } from "./environment.ts";

export const env = readEnvironment(process.env);
