import type {
  ListingCard,
  ListingDetail,
  CategorySummary,
  Paginated,
  TeamCard,
  TeamDetail,
} from "@fusion-lab/shared-types";

// Server-side twin of api-client.ts, for the public pages that render on
// the server (home, catalogue, listing detail). It deliberately does NOT
// import ./firebase: the client SDK cannot run in a Server Component, and
// none of these endpoints need a user anyway.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getPublic<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    // A dead API must not turn the whole storefront into an error page:
    // the shell still renders, with an empty catalogue and a visible
    // "nothing here" state.
    return fallback;
  }
}

const EMPTY_PAGE: Paginated<ListingCard> = {
  items: [],
  total: 0,
  page: 1,
  perPage: 12,
  pages: 0,
};

export function searchCatalog(
  query: Record<string, string | undefined>,
): Promise<Paginated<ListingCard>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getPublic<Paginated<ListingCard>>(`/catalog${suffix}`, EMPTY_PAGE);
}

export function fetchCategories(): Promise<CategorySummary[]> {
  return getPublic<CategorySummary[]>("/catalog/categories", []);
}

export async function fetchListing(slug: string): Promise<ListingDetail | null> {
  const response = await fetch(`${API_URL}/catalog/${slug}`, {
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) return null;
  return (await response.json()) as ListingDetail;
}

export function fetchTeams(
  query: Record<string, string | undefined>,
): Promise<TeamCard[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return getPublic<TeamCard[]>(`/teams${suffix}`, []);
}

export async function fetchTeam(id: string): Promise<TeamDetail | null> {
  const response = await fetch(`${API_URL}/teams/${id}`, {
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) return null;
  return (await response.json()) as TeamDetail;
}
