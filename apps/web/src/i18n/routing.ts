import { defineRouting } from "next-intl/routing";

// uk is the default and carries no prefix in the URL (/catalog, not
// /uk/catalog) — the marketplace's actual users are Ukrainian, so that
// path should look exactly like it did before i18n existed. English is
// the demonstration language for the portfolio audience, always prefixed
// (/en/catalog).
export const routing = defineRouting({
  locales: ["uk", "en"],
  defaultLocale: "uk",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
