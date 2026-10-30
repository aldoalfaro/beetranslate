import type { UiLocale } from "@/lib/i18n";

export const LANGUAGES = [
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
  { id: "en", name: "English" },
  { id: "ko", name: "Korean" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

const DISPLAY_NAMES: Record<UiLocale, Record<LanguageId, string>> = {
  en: { es: "Spanish", fr: "French", en: "English", ko: "Korean" },
  es: { es: "Español", fr: "Francés", en: "Inglés", ko: "Coreano" },
};

export function isLanguageId(value: string): value is LanguageId {
  return LANGUAGES.some((language) => language.id === value);
}

export function languageName(value: string, locale: UiLocale = "en"): string {
  if (isLanguageId(value)) return DISPLAY_NAMES[locale][value];
  return value;
}
