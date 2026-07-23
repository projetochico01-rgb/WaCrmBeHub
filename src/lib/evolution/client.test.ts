import { afterEach, describe, expect, it, vi } from "vitest";
import { getEvolutionInstanceDetails, logoutEvolutionInstance, sendEvolutionInteractive, setEvolutionWebhook } from "./client";

describe("sendEvolutionInteractive", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps reply buttons to Evolution v2", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ key: { id: "msg-1" } }), { status: 201, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendEvolutionInteractive(
      { baseUrl: "https://evolution.example.com", apiKey: "secret", instance: "BeHub" },
      { number: "5547988976484", payload: { kind: "buttons", body: "Como prefere continuar?", buttons: [{ id: "humano", title: "Falar com humano" }] } },
    )).resolves.toBe("msg-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://evolution.example.com/message/sendButtons/BeHub");
    expect(JSON.parse(String(init?.body))).toMatchObject({ buttons: [{ type: "reply", displayText: "Falar com humano", id: "humano" }] });
  });

  it("maps lists and preserves row ids", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ key: { id: "msg-2" } }), { status: 201, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await sendEvolutionInteractive(
      { baseUrl: "https://evolution.example.com", apiKey: "secret", instance: "BeHub" },
      { number: "5547988976484", payload: { kind: "list", body: "Escolha", button_label: "Ver opções", sections: [{ rows: [{ id: "fatura", title: "Enviar fatura" }] }] } },
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://evolution.example.com/message/sendList/BeHub");
    expect(JSON.parse(String(init?.body))).toMatchObject({ sections: [{ rows: [{ rowId: "fatura" }] }] });
  });
});

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
