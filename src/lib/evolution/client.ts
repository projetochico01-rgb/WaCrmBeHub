export interface EvolutionCredentials {
  baseUrl: string;
  apiKey: string;
  instance: string;
}

export interface EvolutionInstanceDetails {
  instanceName: string;
  instanceId: string | null;
  status: string;
  connectedPhone: string | null;
  profileName: string | null;
}

export class EvolutionApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "EvolutionApiError";
  }
}

function endpoint(config: EvolutionCredentials, path: string): string {
  return `${config.baseUrl.replace(/\/$/, "")}${path}`;
}

async function evolutionFetch<T>(
  config: EvolutionCredentials,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(endpoint(config, path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: config.apiKey,
      ...init.headers,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === "object"
      ? JSON.stringify(payload)
      : `HTTP ${response.status}`;
    throw new EvolutionApiError(response.status, detail);
  }
  return payload as T;
}

export async function sendEvolutionText(
  config: EvolutionCredentials,
  number: string,
  text: string,
  quotedId?: string,
): Promise<string> {
  const result = await evolutionFetch<{ key?: { id?: string } }>(
    config,
    `/message/sendText/${encodeURIComponent(config.instance)}`,
    {
      method: "POST",
      body: JSON.stringify({
        number,
        text,
        linkPreview: true,
        ...(quotedId ? { quoted: { key: { id: quotedId } } } : {}),
      }),
    },
  );
  if (!result.key?.id) throw new EvolutionApiError(502, "Resposta sem ID da mensagem");
  return result.key.id;
}

export async function sendEvolutionMedia(
  config: EvolutionCredentials,
  input: {
    number: string;
    type: "image" | "video" | "document" | "audio";
    media: string;
    caption?: string;
    filename?: string;
  },
): Promise<string> {
  const result = await evolutionFetch<{ key?: { id?: string } }>(
    config,
    `/message/sendMedia/${encodeURIComponent(config.instance)}`,
    {
      method: "POST",
      body: JSON.stringify({
        number: input.number,
        mediatype: input.type,
        mimetype: input.type === "document" ? "application/octet-stream" : `${input.type}/*`,
        caption: input.caption || "",
        media: input.media,
        fileName: input.filename || `arquivo-${Date.now()}`,
      }),
    },
  );
  if (!result.key?.id) throw new EvolutionApiError(502, "Resposta sem ID da mensagem");
  return result.key.id;
}

export function getEvolutionQr(config: EvolutionCredentials) {
  return evolutionFetch<{ pairingCode?: string; code?: string; base64?: string; count?: number }>(
    config,
    `/instance/connect/${encodeURIComponent(config.instance)}`,
  );
}

export function getEvolutionConnection(config: EvolutionCredentials) {
  return evolutionFetch<unknown>(
    config,
    `/instance/connectionState/${encodeURIComponent(config.instance)}`,
  );
}

export async function getEvolutionInstanceDetails(
  config: EvolutionCredentials,
): Promise<EvolutionInstanceDetails | null> {
  const payload = await evolutionFetch<unknown>(
    config,
    `/instance/fetchInstances?instanceName=${encodeURIComponent(config.instance)}`,
  );
  const entries = Array.isArray(payload) ? payload : [payload];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const wrapper = entry as Record<string, unknown>;
    const value = wrapper.instance && typeof wrapper.instance === "object"
      ? wrapper.instance as Record<string, unknown>
      : wrapper;
    const instanceName = String(value.instanceName ?? value.name ?? "");
    if (instanceName && instanceName !== config.instance) continue;
    const owner = String(value.owner ?? value.ownerJid ?? value.number ?? "");
    return {
      instanceName: instanceName || config.instance,
      instanceId: value.instanceId || value.id ? String(value.instanceId ?? value.id) : null,
      status: String(value.status ?? value.connectionStatus ?? value.state ?? "close").toLowerCase(),
      connectedPhone: owner ? owner.replace(/@.*$/, "").replace(/\D/g, "") || null : null,
      profileName: value.profileName ? String(value.profileName) : null,
    };
  }
  return null;
}

export function setEvolutionWebhook(
  config: EvolutionCredentials,
  url: string,
) {
  return evolutionFetch<unknown>(
    config,
    `/webhook/set/${encodeURIComponent(config.instance)}`,
    {
      method: "POST",
      body: JSON.stringify({
        // Evolution 2.3.7 expects the settings nested under `webhook`.
        // The public v2 docs show the fields at the root, but that shape
        // returns: instance requires property "webhook" on this instance.
        webhook: {
          enabled: true,
          url,
          webhookByEvents: false,
          webhookBase64: true,
          events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE"],
        },
      }),
    },
  );
}
