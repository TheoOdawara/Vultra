import { beforeEach, describe, expect, it } from "bun:test";
import { t } from "elysia";
import { createHttpApp } from "./http.app.ts";

type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: { field: string; rule: string; message: string }[];
  };
};

let handlerCalls: number;

function buildApp() {
  handlerCalls = 0;

  return createHttpApp()
    .post(
      "/v1/members",
      ({ body }) => {
        handlerCalls += 1;
        return { id: "0198c4a1-6f3e-7c21-9a44-1b2c3d4e5f60", name: body.name };
      },
      {
        body: t.Object({ name: t.String({ minLength: 1 }) }, { additionalProperties: false }),
        response: t.Object({ id: t.String(), name: t.String() }),
      }
    )
    .post(
      "/v1/classes",
      () => {
        handlerCalls += 1;
        return { ok: true };
      },
      {
        body: t.Object({ name: t.String() }),
        response: t.Object({ ok: t.Boolean() }),
      }
    )
    .get(
      "/v1/members",
      () => {
        handlerCalls += 1;
        return { items: [] };
      },
      {
        query: t.Object({ limit: t.Optional(t.String()) }, { additionalProperties: false }),
        response: t.Object({ items: t.Array(t.String()) }),
      }
    );
}

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  app = buildApp();
});

function postMembers(body: Record<string, unknown>): Promise<Response> {
  return app.handle(
    new Request("http://api.local/v1/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("an unknown request field is rejected, never dropped", () => {
  it("answers 422 and names the field and the rule it broke", async () => {
    const response = await postMembers({ name: "Ada", nickname: "unrequested" });
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details).toEqual([
      {
        field: "nickname",
        rule: "objectAdditionalProperties",
        message: expect.any(String),
      },
    ]);
  });

  it("never reaches the handler", async () => {
    await postMembers({ name: "Ada", nickname: "unrequested" });

    expect(handlerCalls).toBe(0);
  });

  it("rejects a server-owned field a client tried to write", async () => {
    const response = await postMembers({ name: "Ada", role: "gestor" });
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error.details?.map((violation) => violation.field)).toEqual(["role"]);
    expect(handlerCalls).toBe(0);
  });

  it("rejects it on a schema that does not declare additionalProperties itself", async () => {
    const response = await app.handle(
      new Request("http://api.local/v1/classes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Turma A", organizationId: "other" }),
      })
    );

    expect(response.status).toBe(422);
    expect(handlerCalls).toBe(0);
  });

  it("rejects an unknown query field", async () => {
    const response = await app.handle(new Request("http://api.local/v1/members?organizationId=other"));

    expect(response.status).toBe(422);
    expect(handlerCalls).toBe(0);
  });
});

describe("a well-formed request is untouched", () => {
  it("reaches the handler and answers the declared response", async () => {
    const response = await postMembers({ name: "Ada" });

    expect(response.status).toBe(200);
    expect(handlerCalls).toBe(1);
    expect(await response.json()).toEqual({
      id: "0198c4a1-6f3e-7c21-9a44-1b2c3d4e5f60",
      name: "Ada",
    });
  });

  it("keeps a declared response schema working with normalization off", async () => {
    const response = await app.handle(new Request("http://api.local/v1/members"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
  });
});
