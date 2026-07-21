import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evolutionWebhookSecret, validEvolutionWebhookSecret } from "./webhook-secret";

describe("Evolution webhook secret", () => {
  const previous = process.env.ENCRYPTION_KEY;

  beforeEach(() => { process.env.ENCRYPTION_KEY = "test-encryption-key-with-enough-entropy"; });
  afterEach(() => {
    if (previous === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previous;
  });

  it("is stable per account and different between accounts", () => {
    expect(evolutionWebhookSecret("account-a")).toBe(evolutionWebhookSecret("account-a"));
    expect(evolutionWebhookSecret("account-a")).not.toBe(evolutionWebhookSecret("account-b"));
  });

  it("verifies only the matching account secret", () => {
    const secret = evolutionWebhookSecret("account-a");
    expect(validEvolutionWebhookSecret("account-a", secret)).toBe(true);
    expect(validEvolutionWebhookSecret("account-b", secret)).toBe(false);
    expect(validEvolutionWebhookSecret("account-a", null)).toBe(false);
  });
});
