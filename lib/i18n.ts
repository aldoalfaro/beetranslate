export type UiLocale = "en" | "es";

const copy = {
  en: {
    metaDescription: "Translate PDF, Word, or pasted text between Spanish, French, English, and Korean.",
    from: "From",
    to: "To",
    sourceText: "Source text",
    sourcePlaceholder: "Paste text, or drop a PDF or Word file.",
    customInstructions: "Custom Instructions",
    instructionsPlaceholder: "Tone, names to keep, or how a term should be handled.",
    dropFile: "Drop the file",
    remove: "Remove",
    upload: "Upload",
    translate: "Translate",
    reading: "Reading",
    differentLanguages: "Choose two different languages.",
    tooLong: "This text is too long to translate in one pass.",
    shorten: "Shorten the text and try again.",
    maximum: "is the maximum.",
    oneSegment: "1 segment",
    segments: "segments",
    copy: "Copy",
    copied: "Copied",
    download: "Download",
    preparing: "Preparing",
    new: "New",
    discard: "Discard",
    retry: "Retry",
    retrying: "Retrying",
    translating: "Translating",
    waiting: "Waiting",
    note: "Note",
    translationNote: "Translation note",
    segmentFailed: "This segment did not translate.",
    segmentEmpty: "This segment came back empty.",
    fileUnreadable: "The file could not be read.",
    fileUnprepared: "The file could not be prepared.",
    translationTitle: "Translation",
    of: "of",
    notes: "Notes",
  },
  es: {
    metaDescription: "Traduce PDF, Word o texto pegado entre español, francés, inglés y coreano.",
    from: "De",
    to: "A",
    sourceText: "Texto de origen",
    sourcePlaceholder: "Pega un texto, o suelta un PDF o un archivo de Word.",
    customInstructions: "Instrucciones personalizadas",
    instructionsPlaceholder: "El tono, los nombres que hay que conservar, o cómo tratar un término.",
    dropFile: "Suelta el archivo",
    remove: "Quitar",
    upload: "Subir",
    translate: "Traducir",
    reading: "Leyendo",
    differentLanguages: "Elige dos idiomas distintos.",
    tooLong: "Este texto es demasiado largo para traducirlo de una sola vez.",
    shorten: "Acorta el texto e inténtalo de nuevo.",
    maximum: "es el máximo.",
    oneSegment: "1 segmento",
    segments: "segmentos",
    copy: "Copiar",
    copied: "Copiado",
    download: "Descargar",
    preparing: "Preparando",
    new: "Nuevo",
    discard: "Descartar",
    retry: "Reintentar",
    retrying: "Reintentando",
    translating: "Traduciendo",
    waiting: "En espera",
    note: "Nota",
    translationNote: "Nota de traducción",
    segmentFailed: "Este segmento no se tradujo.",
    segmentEmpty: "Este segmento volvió vacío.",
    fileUnreadable: "No se pudo leer el archivo.",
    fileUnprepared: "No se pudo preparar el archivo.",
    translationTitle: "Traducción",
    of: "de",
    notes: "Notas",
  },
} as const;

export type CopyKey = keyof (typeof copy)["en"];

const knownErrors: Record<string, string> = {
  "The request could not be read.": "No se pudo leer la solicitud.",
  "Choose Spanish, French, English, or Korean.": "Elige español, francés, inglés o coreano.",
  "Choose two different languages.": "Elige dos idiomas distintos.",
  "That segment cannot be translated.": "Ese segmento no se puede traducir.",
  "This segment did not translate.": "Este segmento no se tradujo.",
  "The file could not be read.": "No se pudo leer el archivo.",
  "Choose a PDF or Word file.": "Elige un archivo PDF o de Word.",
  "This file could not be read.": "No se pudo leer este archivo.",
  "That file is larger than 15 MB.": "Ese archivo pesa más de 15 MB.",
  "Use a PDF or Word file.": "Usa un archivo PDF o de Word.",
  "This file could not be read. Try a PDF or Word file with selectable text.":
    "No se pudo leer este archivo. Prueba con un PDF o un Word que tenga texto seleccionable.",
  "No selectable text was found. Scanned pages need to be pasted instead.":
    "No hay texto seleccionable. Las páginas escaneadas hay que pegarlas.",
  "OPENAI_API_KEY is not set.": "OPENAI_API_KEY no está configurada.",
  "Translation failed.": "La traducción falló.",
  "OpenAI refused the API key.": "OpenAI rechazó la clave de API.",
  "OpenAI is rate limiting requests. Wait a moment, then retry.":
    "OpenAI está limitando las solicitudes. Espera un momento y reintenta.",
  "The configured model is unavailable. Set OPENAI_MODEL and try again.":
    "El modelo configurado no está disponible. Define OPENAI_MODEL e inténtalo de nuevo.",
  "The model returned an unreadable response.": "El modelo devolvió una respuesta ilegible.",
  "The model returned an empty translation.": "El modelo devolvió una traducción vacía.",
  "The document could not be read.": "No se pudo leer el documento.",
  "The source language is missing.": "Falta el idioma de origen.",
  "The target language is missing.": "Falta el idioma de destino.",
  "The document needs a title.": "El documento necesita un título.",
  "There is nothing to export.": "No hay nada que exportar.",
  "A segment is missing.": "Falta un segmento.",
  "A translation is missing.": "Falta una traducción.",
  "A translation is too long to export.": "Una traducción es demasiado larga para exportarla.",
  "The PDF could not be prepared.": "No se pudo preparar el PDF.",
  "The Word file could not be prepared.": "No se pudo preparar el archivo de Word.",
  "The file could not be prepared.": "No se pudo preparar el archivo.",
};

export function uiLocaleFromHeader(header: string | null | undefined): UiLocale {
  const primary = header?.split(",")[0]?.split(";")[0]?.trim().toLowerCase() ?? "";
  return primary === "es" || primary.startsWith("es-") ? "es" : "en";
}

export function t(locale: UiLocale, key: CopyKey): string {
  return copy[locale][key];
}

export function segmentCount(locale: UiLocale, count: number): string {
  return count === 1 ? t(locale, "oneSegment") : `${count} ${t(locale, "segments")}`;
}

export function noteOnSegment(locale: UiLocale, index: number): string {
  return locale === "es" ? `Nota del segmento ${index}` : `Note on segment ${index}`;
}

export function translationField(locale: UiLocale, index: number): string {
  return locale === "es" ? `Traducción ${index}` : `Translation ${index}`;
}

export function localizeKnownError(locale: UiLocale, message: string): string {
  if (locale !== "es") return message;
  return knownErrors[message] ?? message;
}

export function isFatalTranslationError(message: string): boolean {
  return /API key|OPENAI_API_KEY|rate limit|model is unavailable|not set|clave de API|limitando las solicitudes|modelo configurado/i.test(
    message,
  );
}
