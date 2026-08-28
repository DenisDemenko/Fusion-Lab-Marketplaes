// Ukrainian titles have to survive the trip into a URL. Postgres does not
// transliterate and neither does encodeURIComponent (it would produce
// %D0%BA%D1%83... — unreadable and unshareable), so we do it here, using
// the official KMU 55:2010 romanisation the rest of the country's
// documents use.

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
  ъ: '',
  ы: 'y',
  э: 'e',
  ё: 'e',
};

export function slugify(input: string): string {
  const transliterated = input
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('');

  const slug = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  // Everything can transliterate away (a title of only punctuation, or
  // scripts this table does not cover) — an empty slug would collide with
  // itself on the very next insert, so fall back to something unique.
  return slug || `item-${Date.now().toString(36)}`;
}

// Slugs are unique in the database, so a caller has to be able to try
// again: "kurs-fusion", "kurs-fusion-2", "kurs-fusion-3".
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let suffix = 1;

  while (await exists(candidate)) {
    suffix += 1;
    candidate = `${root}-${suffix}`;
  }

  return candidate;
}
