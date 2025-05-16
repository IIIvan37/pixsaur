import { defineConfig } from "@lingui/cli";

export default defineConfig({
  sourceLocale: "en",
  locales: ["cs", "en"],
  catalogs: [
    {
      path: "./src/locales/i18n",
      include: ["src"],
    },
  ],
});