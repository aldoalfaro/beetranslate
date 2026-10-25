import { attachmentHeaders, downloadName } from "@/lib/download-name";
import { ExportInputError, readExportRequest } from "@/lib/export-request";
import { renderDocx } from "@/lib/docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = readExportRequest(await request.json());
    const docx = await renderDocx(body);
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
    return Response.json({ error: message }, { status });
  }
}
