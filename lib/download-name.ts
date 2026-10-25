export function downloadName(title: string, extension: string): string {
  const base = title
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${base || "bee-translate"}.${extension}`;
}

export function attachmentHeaders(filename: string, contentType: string): HeadersInit {
  const fallback = filename.replace(/[^\u0020-\u007E]/g, "_").replace(/"/g, "");
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
  };
}
