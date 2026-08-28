import Link from "next/link";
import { ListingCard } from "@/components/listing-card";
import { fetchCategories, searchCatalog } from "@/lib/server-api";

// Server-rendered: the storefront has no user-specific content, so it is
// fetched on the server and arrives as HTML — which is also what makes it
// indexable.
export default async function HomePage() {
  const [featured, courses, categories] = await Promise.all([
    searchCatalog({ perPage: "8" }),
    searchCatalog({ kind: "course", perPage: "4" }),
    fetchCategories(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid gap-8 py-14 md:grid-cols-2 md:items-center md:py-20">
        <div>
          <span className="badge bg-[var(--accent-soft)] text-[var(--accent)]">
            Fusion 360 · 3D-друк · ЧПУ · БПЛА
          </span>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl">
            Курси, книги та вироби лабораторії — в одному місці
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Купуйте курси з покроковою програмою, завантажуйте матеріали
            одразу після оплати або замовляйте надруковані вироби лабораторії.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/catalog" className="btn-primary">
              Перейти до каталогу
            </Link>
            <Link href="/seller" className="btn-ghost">
              Продавати свої курси
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {courses.items.slice(0, 4).map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="pb-4">
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((category) => (category.listingCount ?? 0) > 0)
              .map((category) => (
                <Link
                  key={category.slug}
                  href={`/catalog?category=${category.slug}`}
                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-zinc-700 hover:border-zinc-400"
                >
                  {category.name}
                  <span className="ml-2 text-zinc-400">
                    {category.listingCount}
                  </span>
                </Link>
              ))}
          </div>
        </section>
      ) : null}

      <section className="py-10">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="section-title">Нове в каталозі</h2>
          <Link
            href="/catalog"
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            Дивитись усе →
          </Link>
        </div>

        {featured.items.length === 0 ? (
          <p className="card p-10 text-center text-zinc-500">
            Каталог поки порожній. Якщо проєкт щойно розгорнуто — запустіть
            <code className="mx-1 rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
              npm run db:seed
            </code>
            в apps/api.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section className="card my-10 grid gap-6 p-8 sm:grid-cols-3">
        <Feature
          title="Оплата карткою"
          body="LiqPay: оплата в гривні, доступ відкривається автоматично після підтвердження банку."
        />
        <Feature
          title="Матеріали одразу"
          body="Після оплати файли курсу зʼявляються в розділі «Мої матеріали» — завантажуйте будь-коли."
        />
        <Feature
          title="Кабінет продавця"
          body="Створюйте лістинги, завантажуйте матеріали, стежте за продажами і виплатами."
        />
      </section>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-semibold text-zinc-900">{title}</p>
      <p className="mt-1.5 text-sm text-zinc-600">{body}</p>
    </div>
  );
}
