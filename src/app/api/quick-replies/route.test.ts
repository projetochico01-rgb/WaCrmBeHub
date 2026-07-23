import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted: Array<Record<string, unknown>> = [];

function makeDatabase() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.insert = vi.fn((row: Record<string, unknown>) => {
    inserted.push(row);
    return builder;
  });
  builder.select = vi.fn(chain);
  builder.single = vi.fn(async () => ({ data: { id: "reply-1", ...inserted.at(-1) }, error: null }));
  return { from: vi.fn(() => builder) };
}

let database = makeDatabase();

vi.mock("@/lib/auth/account", () => ({
  requireRole: vi.fn(async () => ({
    supabase: database,
    accountId: "account-1",
    userId: "user-1",
    role: "agent",
  })),
  toErrorResponse: vi.fn(() => new Response(null, { status: 500 })),
  getCurrentAccount: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/quick-replies", () => {
  beforeEach(() => {
    inserted.length = 0;
    database = makeDatabase();
  });

  it("creates text using the authenticated RLS client", async () => {
    const response = await POST(new Request("http://localhost/api/quick-replies", {
      method: "POST",
      body: JSON.stringify({ title: "Bom dia", kind: "text", content_text: "Olá!" }),
    }));

    expect(response.status).toBe(201);
    expect(database.from).toHaveBeenCalledWith("quick_replies");
    expect(inserted[0]).toMatchObject({
      account_id: "account-1",
      user_id: "user-1",
      title: "Bom dia",
      kind: "text",
      content_text: "Olá!",
    });
  });

  it("rejects an invalid interactive payload before writing", async () => {
    const response = await POST(new Request("http://localhost/api/quick-replies", {
      method: "POST",
      body: JSON.stringify({ title: "Escolha", kind: "interactive", interactive_payload: {} }),
    }));

    expect(response.status).toBe(400);
    expect(inserted).toHaveLength(0);
  });
});
