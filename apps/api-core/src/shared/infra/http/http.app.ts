import Elysia from "elysia";
import { httpPlugin } from "./http.plugin.ts";

export function createHttpApp() {
  return new Elysia({ normalize: false }).use(httpPlugin);
}
