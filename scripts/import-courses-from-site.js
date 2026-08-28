#!/usr/bin/env node
/*
 * One-off importer: turns the legacy Firebase site's course data
 * (../site/assets/js/courses-data.js — a browser file that assigns
 * window.COURSES) into a JSON file this repo owns.
 *
 * It is committed rather than run at seed time on purpose. The seed must
 * work inside the API container, which has no sibling `site/` directory,
 * and the marketplace must be free to edit its own copy without touching
 * the live grant portal. Re-run it only if the source catalogue changes:
 *
 *   node scripts/import-courses-from-site.js ../site/assets/js/courses-data.js
 *
 * What it deliberately drops: `veteranRehab` (grant-programme framing that
 * does not belong on a commercial listing — see ROADMAP phase 1),
 * `videoPlaylistUrl` and `includesImage` (dead links into the old site).
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourceArg = process.argv[2] ?? '../site/assets/js/courses-data.js';
const sourcePath = path.resolve(process.cwd(), sourceArg);
const targetPath = path.resolve(
  __dirname,
  '../apps/api/prisma/seed-data/courses.json',
);

// Prices are a product decision, not something the old site recorded: it
// listed courses without any. They live here so the seed stays declarative
// and one place answers "why does this course cost that".
const PRICE_UAH = {
  'steam-educators': 6900,
  'steam-students': 4900,
  'furniture-makers': 8400,
  'uav-designers': 9800,
  'university-students': 5600,
  'cnc-machining': 11200,
  'ceramic-3d-printing': 2400,
  'art-therapy-veterans': 1800,
  'uav-mastery': 14500,
  'cnc-machining-pro': 16800,
};

const CATEGORY = {
  'steam-educators': 'osvita',
  'steam-students': 'osvita',
  'university-students': 'osvita',
  'furniture-makers': 'mebli',
  'uav-designers': 'bpla',
  'uav-mastery': 'bpla',
  'cnc-machining': 'chpu',
  'cnc-machining-pro': 'chpu',
  'ceramic-3d-printing': '3d-druk',
  'art-therapy-veterans': 'art',
};

const source = fs.readFileSync(sourcePath, 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const courses = sandbox.window.COURSES;
if (!Array.isArray(courses) || courses.length === 0) {
  throw new Error(`No window.COURSES found in ${sourcePath}`);
}

const imported = courses.map((course) => {
  const lessonCount = (course.modules ?? []).reduce(
    (sum, module) => sum + (module.lessons?.length ?? 0),
    0,
  );

  return {
    externalId: course.id,
    title: course.title,
    subtitle: course.subtitle ?? null,
    summary:
      course.description?.slice(0, 400) ??
      `${course.modules?.length ?? 0} модулів, ${lessonCount} занять`,
    description: course.description ?? '',
    coverUrl: course.image ?? null,
    priceUah: PRICE_UAH[course.id] ?? 5000,
    categorySlug: CATEGORY[course.id] ?? 'kursy',
    highlights: [
      ...(course.duration ? [course.duration] : []),
      ...(course.format ? [course.format] : []),
      `${course.modules?.length ?? 0} модулів · ${lessonCount} занять`,
      ...(course.results ?? []).slice(0, 3),
    ],
    curriculum: {
      targetAudience: course.targetAudience ?? [],
      results: course.results ?? [],
      includes: course.includes ?? null,
      duration: course.duration ?? null,
      format: course.format ?? null,
      modules: course.modules ?? [],
    },
  };
});

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, `${JSON.stringify(imported, null, 2)}\n`, 'utf8');

console.log(
  `Imported ${imported.length} courses -> ${path.relative(process.cwd(), targetPath)}`,
);
