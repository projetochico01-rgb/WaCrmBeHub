export function serializeHermesFieldValue(fieldType: string, value: unknown): string | null {
  if (fieldType === "number") {
    const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
    if (normalized === "" || normalized === null || normalized === undefined) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? String(number) : null;
  }

  if (fieldType === "boolean") {
    if (typeof value === "boolean") return String(value);
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "sim", "yes"].includes(normalized)) return "true";
      if (["false", "0", "não", "nao", "no"].includes(normalized)) return "false";
    }
    return null;
  }

  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}
