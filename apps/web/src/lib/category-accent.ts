// docs/migration-plan.md Phase B6: two accents, chosen by category, not by
// listing kind — a course and a product in the same category (e.g. both
// "bpla") get the same accent. Craft is the default (globals.css's --accent
// already resolves to craft with no class needed); tech categories opt in
// via the .accent-tech class, which locally overrides --accent/--accent-soft
// for everything inside it.
//
// Mirrors apps/api/prisma/seed.ts's CATEGORIES: craft = mebli, art, osvita,
// vyroby, kursy (handmade/creative, including STEAM per the lab's own style
// guide); tech = bpla, chpu, 3d-druk (fabrication/digital).
const TECH_CATEGORY_SLUGS = new Set(["bpla", "chpu", "3d-druk"]);

export function accentClassForCategory(slug: string | null | undefined): string {
  return slug && TECH_CATEGORY_SLUGS.has(slug) ? "accent-tech" : "";
}
