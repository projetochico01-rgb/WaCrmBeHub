import { describe, expect, it } from "vitest";
import { isBehubCommercialTime, nextBehubCommercialTime } from "./business-hours";

describe("horario comercial BeHub", () => {
  it("aceita os dois turnos de segunda a sexta", () => {
    expect(isBehubCommercialTime(new Date("2026-07-20T11:00:00Z"))).toBe(true); // 08:00 BRT
    expect(isBehubCommercialTime(new Date("2026-07-20T16:00:00Z"))).toBe(true); // 13:00 BRT
  });

  it("bloqueia intervalo, noite e fim de semana", () => {
    expect(isBehubCommercialTime(new Date("2026-07-20T15:30:00Z"))).toBe(false); // 12:30 BRT
    expect(isBehubCommercialTime(new Date("2026-07-20T21:00:00Z"))).toBe(false); // 18:00 BRT
    expect(isBehubCommercialTime(new Date("2026-07-19T14:00:00Z"))).toBe(false); // domingo
  });

  it("leva uma pendencia noturna para a proxima abertura", () => {
    expect(nextBehubCommercialTime(new Date("2026-07-20T22:10:00Z")).toISOString())
      .toBe("2026-07-21T11:00:00.000Z");
  });
});
