import { beforeEach, describe, expect, it, vi } from "vitest";

let storedEncryptedKey: string | null = "encrypted-existing";
let upsertPayload: Record<string, unknown> | null = null;

function makeDb() {
  const from = vi.fn((table: string) => {
    let mode: "read" | "upsert" = "read";
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = vi.fn(chain);
    builder.eq = vi.fn(chain);
    builder.upsert = vi.fn((payload: Record<string, unknown>) => {
      mode = "upsert";
      upsertPayload = payload;
      return builder;
    });
    builder.maybeSingle = vi.fn(async () => {
      if (table === "evolution_config") {
        return { data: storedEncryptedKey ? { encrypted_api_key: storedEncryptedKey } : null, error: null };
      }
      return { data: null, error: null };
    });
    builder.single = vi.fn(async () => {
      if (table === "profiles") return { data: { account_id: "acct-1" }, error: null };
      if (table === "evolution_config" && mode === "upsert") {
        return { data: { id: "cfg-1", api_url: upsertPayload?.api_url, instance_name: "BeHub", status: "connected", enabled: true }, error: null };
      }
      return { data: null, error: null };
    });
    return builder;
  });

  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })) },
    from,
  };
}

let db = makeDb();

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => db) }));

const encryption = vi.hoisted(() => ({
  decrypt: vi.fn(() => "existing-plaintext"),
  encrypt: vi.fn((value: string) => `encrypted:${value}`),
}));
vi.mock("@/lib/whatsapp/encryption", () => encryption);

const evolution = vi.hoisted(() => ({
  getEvolutionConnection: vi.fn(async () => ({ instance: { state: "open" } })),
  getEvolutionInstanceDetails: vi.fn(async () => ({
    instanceName: "BeHub",
    instanceId: "instance-1",
    status: "open",
    connectedPhone: "5547999999999",
    profileName: "BeHub",
  })),
  setEvolutionWebhook: vi.fn(async () => undefined),
}));
vi.mock("@/lib/evolution/client", () => evolution);

import { POST } from "./route";

function request(body: Record<string, unknown>) {
  return new Request("https://wa-crm-be-hub.vercel.app/api/evolution/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/evolution/config", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-with-enough-entropy";
    storedEncryptedKey = "encrypted-existing";
    upsertPayload = null;
    db = makeDb();
    vi.clearAllMocks();
  });

  it("preserves the encrypted key and normalizes the manager URL", async () => {
    const response = await POST(request({
      api_url: "https://evolution.example.com/manager/",
      api_key: "",
      instance_name: "BeHub",
    }));

    expect(response.status).toBe(200);
    expect(encryption.decrypt).toHaveBeenCalledWith("encrypted-existing");
    expect(encryption.encrypt).not.toHaveBeenCalled();
    expect(evolution.getEvolutionConnection).toHaveBeenCalledWith({
      baseUrl: "https://evolution.example.com",
      apiKey: "existing-plaintext",
      instance: "BeHub",
    });
    expect(upsertPayload).toMatchObject({
      api_url: "https://evolution.example.com",
      encrypted_api_key: "encrypted-existing",
      instance_name: "BeHub",
    });
  });

  it("requires a key on the first configuration", async () => {
    storedEncryptedKey = null;
    const response = await POST(request({
      api_url: "https://evolution.example.com",
      api_key: "",
      instance_name: "BeHub",
    }));

    expect(response.status).toBe(400);
    expect(evolution.getEvolutionConnection).not.toHaveBeenCalled();
  });
});
