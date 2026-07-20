import { afterEach, describe, expect, it, vi } from "vitest";
import { setEvolutionWebhook } from "./client";

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
