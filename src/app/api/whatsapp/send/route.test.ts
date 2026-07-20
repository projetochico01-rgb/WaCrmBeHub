import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const conversationInserts: Array<Record<string, unknown>> = [];
let existingConversation: Record<string, unknown> | null = null;
let contactRow: Record<string, unknown> | null = null;
let createdConversation: Record<string, unknown> | null = null;

const CONTACT = {
  id: "contact-1",
  account_id: "acct-1",
  phone: "+5547988976484",
};

function makeSupabaseMock() {
  function builder(table: string) {
    let didInsert = false;
    const selectResult = () => {
      if (table === "profiles") return { data: { account_id: "acct-1" }, error: null };
      if (table === "contacts") return { data: contactRow, error: null };
      if (table === "conversations") return { data: createdConversation ?? existingConversation, error: null };
      return { data: null, error: null };
    };
    const insertResult = () => {
      if (table === "conversations") {
        return { data: { id: "conv-new", account_id: "acct-1", contact_id: CONTACT.id }, error: null };
      }
      return { data: null, error: null };
    };
    const terminal = () => Promise.resolve(didInsert ? insertResult() : selectResult());
    const b: Record<string, unknown> = {};
    const chain = () => b;
    for (const method of ["select", "eq", "in", "order", "limit", "update", "delete"]) b[method] = vi.fn(chain);
    b.insert = vi.fn((payload: Record<string, unknown>) => {
      didInsert = true;
      if (table === "conversations") {
        conversationInserts.push(payload);
        createdConversation = { id: "conv-new", account_id: "acct-1", contact_id: CONTACT.id, contact: CONTACT };
      }
      return b;
    });
    b.single = vi.fn(terminal);
    b.maybeSingle = vi.fn(terminal);
    b.then = (resolve: (value: unknown) => unknown) => resolve(didInsert ? insertResult() : selectResult());
    return b;
  }

  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })) },
    from: vi.fn((table: string) => builder(table)),
  };
}

let supabaseMock = makeSupabaseMock();

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabaseMock) }));

const evolution = vi.hoisted(() => ({
  hasEvolutionConfig: vi.fn(async () => true),
  sendEvolutionMessageToConversation: vi.fn(async () => ({ messageId: "msg-1", whatsappMessageId: "evo-1" })),
}));

vi.mock("@/lib/evolution/send-message", () => evolution);

import { POST } from "./route";

function postContactText(overrides: Record<string, unknown> = {}) {
  return POST(new Request("http://localhost/api/whatsapp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contact_id: CONTACT.id,
      message_type: "text",
      content_text: "Olá pela Evolution",
      ...overrides,
    }),
  }));
}

describe("POST /api/whatsapp/send — Evolution contact path", () => {
  beforeEach(() => {
    conversationInserts.length = 0;
    existingConversation = null;
    createdConversation = null;
    contactRow = CONTACT;
    supabaseMock = makeSupabaseMock();
    evolution.hasEvolutionConfig.mockClear();
    evolution.sendEvolutionMessageToConversation.mockClear();
  });

  afterEach(() => vi.clearAllMocks());

  it("creates a conversation and sends text through Evolution", async () => {
    const response = await postContactText();
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, message_id: "msg-1", whatsapp_message_id: "evo-1" });
    expect(conversationInserts).toHaveLength(1);
    expect(conversationInserts[0]).toMatchObject({ account_id: "acct-1", contact_id: CONTACT.id });
    expect(evolution.sendEvolutionMessageToConversation).toHaveBeenCalledWith(
      expect.anything(),
      "acct-1",
      expect.objectContaining({
        conversationId: "conv-new",
        messageType: "text",
        contentText: "Olá pela Evolution",
        sentByType: "human",
      }),
    );
  });

  it("reuses the existing conversation", async () => {
    existingConversation = { id: "conv-existing", account_id: "acct-1", contact_id: CONTACT.id, contact: CONTACT };
    const response = await postContactText();
    expect(response.status).toBe(200);
    expect(conversationInserts).toHaveLength(0);
    expect(evolution.sendEvolutionMessageToConversation).toHaveBeenCalledWith(
      expect.anything(),
      "acct-1",
      expect.objectContaining({ conversationId: "conv-existing" }),
    );
  });

  it("returns 404 when the contact belongs to another account", async () => {
    contactRow = null;
    const response = await postContactText();
    expect(response.status).toBe(404);
    expect((await response.json()).error).toMatch(/contact not found/i);
    expect(evolution.sendEvolutionMessageToConversation).not.toHaveBeenCalled();
  });

  it("rejects Meta template messages", async () => {
    const response = await postContactText({ message_type: "template" });
    expect(response.status).toBe(400);
    expect(evolution.sendEvolutionMessageToConversation).not.toHaveBeenCalled();
  });
});
