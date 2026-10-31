import type { Metadata } from "next";
import { headers } from "next/headers";
import { Library } from "@/components/library";
import { t, uiLocaleFromHeader } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = uiLocaleFromHeader((await headers()).get("accept-language"));
  return { title: `${t(locale, "library")} · Bee Translate` };
}

export default async function LibraryPage() {
  const locale = uiLocaleFromHeader((await headers()).get("accept-language"));
  return <Library locale={locale} />;
}
