"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";

interface AdminCategory {
  id: string;
  slug: string;
  name: string;
}

export default function AdminCategoriesPage() {
  return (
    <RequireAuth role="admin">
      <CategoriesScreen />
    </RequireAuth>
  );
}

function CategoriesScreen() {
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setCategories(await api.get<AdminCategory[]>("/admin/categories"));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не вдалося завантажити категорії",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setBusy(true);
    setError(null);
    try {
      await api.post("/admin/categories", { name: name.trim() });
      setName("");
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не вдалося створити категорію",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(slug: string) {
    setError(null);
    try {
      await api.delete(`/admin/categories/${slug}`);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не вдалося видалити категорію",
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="section-title">Категорії</h1>

      <form onSubmit={create} className="card mt-6 flex gap-2 p-4">
        <input
          className="input"
          placeholder="Нова категорія"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={busy}>
          Додати
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {!categories ? (
        <p className="mt-6 text-zinc-500">Завантаження…</p>
      ) : (
        <ul className="card mt-6 divide-y divide-[var(--line)]">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span>
                {category.name}{" "}
                <span className="text-zinc-400">({category.slug})</span>
              </span>
              <button
                type="button"
                className="text-sm text-red-700 hover:underline"
                onClick={() => void remove(category.slug)}
              >
                Видалити
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
