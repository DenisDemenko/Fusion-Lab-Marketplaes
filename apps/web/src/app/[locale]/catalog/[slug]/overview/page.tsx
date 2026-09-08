import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { fetchListing } from "@/lib/server-api";
import { mediaUrl } from "@/lib/api-client";
import { FurnitureCourseOverview } from "@/components/furniture-course-overview";

export async function generateMetadata() {
  const en = (await getLocale()) === "en";
  return {
    title: en
      ? "Fusion for furniture makers — course overview | Fusion Lab"
      : "Fusion для мебелярів — огляд курсу | Fusion Lab",
    description: en
      ? "From a sketch to a furniture project: explore the programme and learning approach."
      : "Від ескізу до проєкту меблів: познайомтеся з програмою та підходом до навчання.",
  };
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug, locale } = await params;
  if (slug !== "furniture-makers") notFound();
  const listing = await fetchListing(slug);
  if (!listing || listing.kind !== "course") notFound();
  const en = locale === "en";
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav
        aria-label={en ? "Breadcrumbs" : "Навігація"}
        className="mb-8 flex flex-wrap gap-2 text-sm text-[var(--muted)]"
      >
        <Link href="/catalog" className="hover:underline">
          {en ? "Catalogue" : "Каталог"}
        </Link>
        <span aria-hidden>/</span>
        <span>{en ? "Course overview" : "Огляд курсу"}</span>
      </nav>
      <FurnitureCourseOverview
        en={en}
        title={listing.title}
        cover={mediaUrl(listing.coverUrl)}
        price={
          en ? listing.priceLabel.replace("грн", "UAH") : listing.priceLabel
        }
        modules={(listing.curriculum?.modules ?? []).map((module) => ({
          title: module.title,
          lessons: (module.lessons ?? []).map((lesson) => lesson.title),
        }))}
      />
    </div>
  );
}
