import { describe, expect, it } from "vitest";
import { serializeHermesFieldValue } from "./structured-fields";

describe("serializeHermesFieldValue", () => {
  it("normalizes valid numbers and rejects invalid values", () => {
    expect(serializeHermesFieldValue("number", " 500,50 ")).toBe("500.5");
    expect(serializeHermesFieldValue("number", 800)).toBe("800");
    expect(serializeHermesFieldValue("number", "quinhentos")).toBeNull();
  });

  it("normalizes supported boolean answers", () => {
    expect(serializeHermesFieldValue("boolean", true)).toBe("true");
    expect(serializeHermesFieldValue("boolean", "sim")).toBe("true");
    expect(serializeHermesFieldValue("boolean", "não")).toBe("false");
    expect(serializeHermesFieldValue("boolean", "talvez")).toBeNull();
  });

  it("requires non-empty text for text fields", () => {
    expect(serializeHermesFieldValue("text", " Rio do Sul ")).toBe("Rio do Sul");
    expect(serializeHermesFieldValue("text", "  ")).toBeNull();
    expect(serializeHermesFieldValue("text", 123)).toBeNull();
  });
});
