import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="mt-16 border-t border-[var(--line)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-semibold">Fusion Lab</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{t("tagline")}</p>
        </div>

        <div className="text-sm">
          <p className="font-medium text-[var(--foreground)]">{t("marketplaceHeading")}</p>
          <ul className="mt-2 space-y-1.5 text-[var(--muted)]">
            <li>
              <Link href="/catalog" className="hover:text-[var(--foreground)]">
                {t("catalog")}
              </Link>
            </li>
            <li>
              <Link href="/catalog?kind=course" className="hover:text-[var(--foreground)]">
                {t("courses")}
              </Link>
            </li>
            <li>
              <Link href="/catalog?kind=product" className="hover:text-[var(--foreground)]">
                {t("products")}
              </Link>
            </li>
            <li>
              <Link href="/catalog?kind=book" className="hover:text-[var(--foreground)]">
                {t("books")}
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-medium text-[var(--foreground)]">{t("accountsHeading")}</p>
          <ul className="mt-2 space-y-1.5 text-[var(--muted)]">
            <li>
              <Link href="/account/library" className="hover:text-[var(--foreground)]">
                {t("myMaterials")}
              </Link>
            </li>
            <li>
              <Link href="/account/orders" className="hover:text-[var(--foreground)]">
                {t("myOrders")}
              </Link>
            </li>
            <li>
              <Link href="/seller" className="hover:text-[var(--foreground)]">
                {t("sellHere")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--line)] px-4 py-4 text-center text-xs text-[var(--muted)]">
        © {new Date().getFullYear()} Fusion Lab
      </div>
    </footer>
  );
}
