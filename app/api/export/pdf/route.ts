import { attachmentHeaders, downloadName } from "@/lib/download-name";
import { ExportInputError, readExportRequest } from "@/lib/export-request";
import { renderPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = readExportRequest(await request.json());
    const pdf = await renderPdf(body);
    return new Response(new Uint8Array(pdf), {
      headers: attachmentHeaders(downloadName(body.title, "pdf"), "application/pdf"),
    });
  } catch (error) {
    if (!(error instanceof ExportInputError)) console.error(error);
    const message = error instanceof ExportInputError ? error.message : "The PDF could not be prepared.";
    const status = error instanceof ExportInputError ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
