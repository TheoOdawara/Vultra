import { builtinEnvironments, type Environment } from "vitest/environments";

const nodeAbortController = globalThis.AbortController;
const nodeAbortSignal = globalThis.AbortSignal;

const environment: Environment = {
  name: "jsdom-node-fetch",
  transformMode: "web",
  async setup(global, options) {
    const jsdom = await builtinEnvironments.jsdom.setup(global, options);

    global.AbortController = nodeAbortController;
    global.AbortSignal = nodeAbortSignal;

    return jsdom;
  },
};

export default environment;
