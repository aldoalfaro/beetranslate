import { headers } from "next/headers";
import { App } from "@/components/app";
import { uiLocaleFromHeader } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; auth?: string }> }) {
  const [locale, params] = await Promise.all([
    headers().then((value) => uiLocaleFromHeader(value.get("accept-language"))),
    searchParams,
  ]);
  return <App locale={locale} initialId={params.id ?? null} authError={params.auth === "error"} />;
}
