import { headers } from "next/headers";
import { App } from "@/components/app";
import { uiLocaleFromHeader } from "@/lib/i18n";

export default async function Page() {
  const locale = uiLocaleFromHeader((await headers()).get("accept-language"));
  return <App locale={locale} />;
}
