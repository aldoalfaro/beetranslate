import { localizeKnownError, uiLocaleFromHeader } from "@/lib/i18n";
import { ExtractError, extractFile } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const locale = uiLocaleFromHeader(request.headers.get("accept-language"));
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: localizeKnownError(locale, "The file could not be read.") }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: localizeKnownError(locale, "Choose a PDF or Word file.") }, { status: 400 });
  }

  try {
    const text = await extractFile(file);
    return Response.json({ text });
  } catch (error) {
    if (error instanceof ExtractError) {
      return Response.json({ error: localizeKnownError(locale, error.message) }, { status: error.status });
    }
    return Response.json({ error: localizeKnownError(locale, "This file could not be read.") }, { status: 422 });
  }
}
