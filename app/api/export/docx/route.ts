import { attachmentHeaders, downloadName } from "@/lib/download-name";
import { renderDocx } from "@/lib/docx";
import { ExportInputError, readExportRequest } from "@/lib/export-request";
import { localizeKnownError, uiLocaleFromHeader } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const locale = uiLocaleFromHeader(request.headers.get("accept-language"));
  try {
    const body = readExportRequest(await request.json());
    const docx = await renderDocx(body, locale);
    return new Response(new Uint8Array(docx), {
      headers: attachmentHeaders(
        downloadName(body.title, "docx"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    });
  } catch (error) {
    if (!(error instanceof ExportInputError)) console.error(error);
    const message = error instanceof ExportInputError ? error.message : "The Word file could not be prepared.";
    const status = error instanceof ExportInputError ? 400 : 500;
    return Response.json({ error: localizeKnownError(locale, message) }, { status });
  }
}
