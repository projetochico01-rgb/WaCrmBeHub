import { afterEach, describe, expect, it, vi } from "vitest";
import { getEvolutionInstanceDetails, logoutEvolutionInstance, setEvolutionWebhook } from "./client";

describe("setEvolutionWebhook", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the nested payload required by Evolution 2.3.7", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ id: "hook-1" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await setEvolutionWebhook(
      { baseUrl: "https://evolution.example.com", apiKey: "secret", instance: "BeHub" },
      "https://crm.example.com/api/evolution/webhook?secret=hook-secret",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://evolution.example.com/webhook/set/BeHub");
    expect(JSON.parse(String(init?.body))).toEqual({
      webhook: {
        enabled: true,
        url: "https://crm.example.com/api/evolution/webhook?secret=hook-secret",
        webhookByEvents: false,
        webhookBase64: true,
        events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE"],
      },
    });
  });
});

describe("getEvolutionInstanceDetails", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes the Evolution 2.3.7 flat instance response", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify([{
      name: "BeHub",
      id: "instance-1",
      connectionStatus: "open",
      ownerJid: "5547987654321@s.whatsapp.net",
      profileName: "BeHub Energia",
    }]), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(getEvolutionInstanceDetails({
      baseUrl: "https://evolution.example.com",
      apiKey: "secret",
      instance: "BeHub",
    })).resolves.toEqual({
      instanceName: "BeHub",
      instanceId: "instance-1",
      status: "open",
      connectedPhone: "5547987654321",
      profileName: "BeHub Energia",
    });
  });
});

describe("logoutEvolutionInstance", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("logs out only the selected instance", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ status: "SUCCESS" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await logoutEvolutionInstance({
      baseUrl: "https://evolution.example.com",
      apiKey: "secret",
      instance: "BeHub",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://evolution.example.com/instance/logout/BeHub",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
