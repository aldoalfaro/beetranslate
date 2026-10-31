import type { NextConfig } from "next";
import path from "path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["pdfkit", "fontkit", "mammoth", "word-extractor", "unpdf"],
};

export default nextConfig;

initOpenNextCloudflareForDev();
