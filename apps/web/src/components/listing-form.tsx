"use client";

import { useEffect, useState } from "react";
import type {
  CategorySummary,
  ListingDetail,
  ListingKind,
  SellerListingDetail,
} from "@fusion-lab/shared-types";
import { api } from "@/lib/api-client";
import { parseCurriculumText, serializeCurriculum } from "@/lib/curriculum-text";

export interface ListingFormValues {
  kind: ListingKind;
  title: string;
  subtitle: string;
  summary: string;
  description: string;
  priceUah: string;
  categorySlug: string;
  coverUrl: string;
  stock: string;
  highlights: string;
  curriculumText: string;
}

export function emptyValues(): ListingFormValues {
  return {
    kind: "course",
    title: "",
    subtitle: "",
    summary: "",
    description: "",
    priceUah: "",
    categorySlug: "",
    coverUrl: "",
    stock: "",
    highlights: "",
    curriculumText: "",
  };
}

// Accepts either shape a listing comes back in: the buyer-facing
// ListingDetail (public catalogue page) and the owner-facing
// SellerListingDetail (seller cabinet). Both share every field this form
// reads — only their media breakdown differs, which this function ignores.
export function valuesFromListing(
  listing: ListingDetail | SellerListingDetail,
): ListingFormValues {
  return {
    kind: listing.kind,
    title: listing.title,
    subtitle: listing.subtitle ?? "",
    summary: listing.summary ?? "",
    description: listing.description ?? "",
    // The form works in hryvnia because that is what a seller types; the
    // conversion to minor units happens in one place, on submit.
    priceUah: (listing.priceMinor / 100).toString(),
    categorySlug: listing.category?.slug ?? "",
    coverUrl: listing.coverUrl?.startsWith("/media/") ? "" : (listing.coverUrl ?? ""),
    stock: listing.stock === null ? "" : String(listing.stock),
    highlights: listing.highlights.join("\n"),
    curriculumText: serializeCurriculum(listing.curriculum),
  };
}

export function toPayload(values: ListingFormValues) {
  const curriculum = parseCurriculumText(values.curriculumText);

  return {
    kind: values.kind,
    title: values.title.trim(),
    subtitle: values.subtitle.trim() || undefined,
    summary: values.summary.trim() || undefined,
    description: values.description.trim() || undefined,
    priceMinor: Math.round(Number(values.priceUah.replace(",", ".")) * 100),
    categorySlug: values.categorySlug || undefined,
    coverUrl: values.coverUrl.trim() || undefined,
    stock: values.stock === "" ? undefined : Number(values.stock),
    highlights: values.highlights
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    curriculum: curriculum ?? undefined,
  };
}

export function ListingFormFields({
  values,
  onChange,
}: {
  values: ListingFormValues;
  onChange: (values: ListingFormValues) => void;
}) {
  const [categories, setCategories] = useState<CategorySummary[]>([]);

  useEffect(() => {
    void api
      .get<CategorySummary[]>("/catalog/categories", { token: null })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  function set<K extends keyof ListingFormValues>(
    key: K,
    value: ListingFormValues[K],
  ) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="kind">
            Тип
          </label>
          <select
            id="kind"
            className="input"
            value={values.kind}
            onChange={(event) => set("kind", event.target.value as ListingKind)}
          >
            <option value="course">Курс</option>
            <option value="product">Виріб</option>
            <option value="book">Книга</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="price">
            Ціна, грн
          </label>
          <input
            id="price"
            className="input"
            inputMode="decimal"
            required
            value={values.priceUah}
            onChange={(event) => set("priceUah", event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="title">
          Назва
        </label>
        <input
          id="title"
          className="input"
          required
          minLength={3}
          value={values.title}
          onChange={(event) => set("title", event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="subtitle">
          Підзаголовок
        </label>
        <input
          id="subtitle"
          className="input"
          value={values.subtitle}
          onChange={(event) => set("subtitle", event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="summary">
          Короткий опис (для картки в каталозі)
        </label>
        <input
          id="summary"
          className="input"
          value={values.summary}
          onChange={(event) => set("summary", event.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="description">
          Повний опис
        </label>
        <textarea
          id="description"
          className="input min-h-32"
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
        />
        <p className="mt-1 text-xs text-zinc-500">
          Для публікації потрібно щонайменше 40 символів.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="category">
            Категорія
          </label>
          <select
            id="category"
            className="input"
            value={values.categorySlug}
            onChange={(event) => set("categorySlug", event.target.value)}
          >
            <option value="">Без категорії</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="stock">
            Залишок (лише для виробів)
          </label>
          <input
            id="stock"
            className="input"
            type="number"
            min={0}
            placeholder="без обмежень"
            value={values.stock}
            onChange={(event) => set("stock", event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="coverUrl">
          Обкладинка за посиланням
        </label>
        <input
          id="coverUrl"
          className="input"
          placeholder="https://…"
          value={values.coverUrl}
          onChange={(event) => set("coverUrl", event.target.value)}
        />
        <p className="mt-1 text-xs text-zinc-500">
          Або завантажте файл обкладинки нижче — завантажений файл має
          пріоритет.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="highlights">
          Ключові тези, по одній на рядок
        </label>
        <textarea
          id="highlights"
          className="input min-h-24"
          value={values.highlights}
          onChange={(event) => set("highlights", event.target.value)}
        />
      </div>

      {values.kind === "course" ? (
        <div>
          <label className="label" htmlFor="curriculum">
            Програма курсу
          </label>
          <textarea
            id="curriculum"
            className="input min-h-40 font-mono text-xs"
            placeholder={"## Модуль 1. Ескізи\n1 заняття. Лінії та розміри\n2 заняття. Обмеження"}
            value={values.curriculumText}
            onChange={(event) => set("curriculumText", event.target.value)}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Рядок, що починається з ##, — це модуль. Інші рядки — заняття
            всередині нього. Для курсу програма обовʼязкова.
          </p>
        </div>
      ) : null}
    </div>
  );
}
