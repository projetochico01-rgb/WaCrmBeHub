import { createHmac, timingSafeEqual } from "node:crypto";

function keyMaterial(): string {
  const value = process.env.ENCRYPTION_KEY;
  if (!value) throw new Error("ENCRYPTION_KEY não configurada");
  return value;
}

export function evolutionWebhookSecret(accountId: string): string {
  return createHmac("sha256", keyMaterial())
    .update(`evolution-webhook:${accountId}`)
    .digest("base64url");
}

export function validEvolutionWebhookSecret(accountId: string, supplied: string | null): boolean {
  if (!supplied) return false;
  const expected = evolutionWebhookSecret(accountId);
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length
    && timingSafeEqual(expectedBytes, suppliedBytes);
}
