export const LANGUAGES = [
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
  { id: "en", name: "English" },
  { id: "ko", name: "Korean" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export function isLanguageId(value: string): value is LanguageId {
  return LANGUAGES.some((language) => language.id === value);
}

export function languageName(value: string): string {
  return LANGUAGES.find((language) => language.id === value)?.name ?? value;
}
