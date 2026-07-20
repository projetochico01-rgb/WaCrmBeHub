const TIME_ZONE = "America/Sao_Paulo";

function parts(date: Date) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    values.find((part) => part.type === type)?.value ?? "";
  return { weekday: get("weekday"), hour: Number(get("hour")), minute: Number(get("minute")) };
}

/** Segunda a sexta, 08:00-12:00 e 13:00-18:00, horario de Brasilia. */
export function isBehubCommercialTime(date = new Date()): boolean {
  const { weekday, hour, minute } = parts(date);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const total = hour * 60 + minute;
  return (total >= 8 * 60 && total < 12 * 60) || (total >= 13 * 60 && total < 18 * 60);
}

/** Proximo instante dentro do expediente, arredondado em passos de 5 min. */
export function nextBehubCommercialTime(from = new Date()): Date {
  const cursor = new Date(from);
  cursor.setUTCSeconds(0, 0);
  const remainder = cursor.getUTCMinutes() % 5;
  cursor.setUTCMinutes(cursor.getUTCMinutes() + (remainder === 0 ? 5 : 5 - remainder));
  for (let i = 0; i < 7 * 24 * 12; i += 1) {
    if (isBehubCommercialTime(cursor)) return cursor;
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 5);
  }
  throw new Error("Nao foi possivel encontrar o proximo horario comercial");
}
