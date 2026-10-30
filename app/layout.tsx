import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { t, uiLocaleFromHeader } from "@/lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = uiLocaleFromHeader((await headers()).get("accept-language"));
  return {
    title: "Bee Translate",
    description: t(locale, "metaDescription"),
  };
}

export const viewport: Viewport = {
  themeColor: "#f3efe6",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = uiLocaleFromHeader((await headers()).get("accept-language"));
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Noto+Serif+KR:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
