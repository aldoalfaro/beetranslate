import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

// OpenNext invokes the Next.js build itself. Point that at `next build`.
// `npm run build` is this OpenNext command, so leaving the default loops until Cloudflare times out.
config.buildCommand = "npm run build:next";

export default config;
