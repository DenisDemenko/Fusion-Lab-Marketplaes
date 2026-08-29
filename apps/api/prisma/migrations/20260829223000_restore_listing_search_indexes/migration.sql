-- Відновлення двох пошукових індексів Listing.
--
-- Їх створено сирим SQL у 20260828163354_phase1_marketplace, тож Prisma їх не
-- моделює: `searchVector` описаний у схемі як Unsupported("tsvector"), а
-- gin_trgm_ops на title не виражається в Prisma-схемі взагалі. Через це
-- автогенератор вважав обидва індекси дрейфом і вставив їм DROP у міграцію
-- 20260829221412_sales_manager_invites. Та міграція впала на наступному кроці
-- (DROP DEFAULT на generated-колонці), але DROP-и виконатись устигли.
--
-- IF NOT EXISTS — щоб міграція лишалась безпечною для баз, де індекси не
-- дропались (наприклад, свіжозібраної тестової).
CREATE INDEX IF NOT EXISTS "Listing_searchVector_idx" ON "Listing" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "Listing_title_trgm_idx" ON "Listing" USING GIN ("title" gin_trgm_ops);
