import { describe, expect, it } from "vitest";
import { resolveSection, SETTINGS_SECTIONS } from "./settings-sections";

describe("settings navigation", () => {
  it("keeps legacy Models out of the visible sections", () => {
    expect(SETTINGS_SECTIONS).not.toContain("templates");
    expect(resolveSection("templates")).toBe("whatsapp");
  });

  it("falls back safely for unknown sections", () => {
    expect(resolveSection("anything-else")).toBe("overview");
    expect(resolveSection(null)).toBe("overview");
  });
});
