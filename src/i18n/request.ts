import { getRequestConfig } from "next-intl/server";
import englishMessages from "../../messages/en.json";
import portugueseMessages from "../../messages/pt-BR.json";

type Messages = Record<string, unknown>;

function mergeMessages(base: Messages, translated: Messages): Messages {
  const result: Messages = { ...base };

  for (const [key, value] of Object.entries(translated)) {
    const baseValue = base[key];
    result[key] =
      value && baseValue &&
      typeof value === "object" && typeof baseValue === "object" &&
      !Array.isArray(value) && !Array.isArray(baseValue)
        ? mergeMessages(baseValue as Messages, value as Messages)
        : value;
  }

  return result;
}

export default getRequestConfig(async () => {
  const requestedLocale = process.env.NEXT_PUBLIC_APP_LOCALE || "pt-BR";
  const locale = requestedLocale === "pt-BR" ? "pt-BR" : "en";
  const messages = locale === "pt-BR"
    ? mergeMessages(englishMessages, portugueseMessages)
    : englishMessages;

  return { locale, messages };
});
