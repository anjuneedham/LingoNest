/**
 * Compiles the authored curricula into validated JSON bundles.
 *
 * Output:
 *   dist/<lang>.json         everything for one language, for seeding
 *   dist/manifest.json       language list, versions and content hashes
 *
 * The hash lets the app tell whether its cached bundle is stale without
 * downloading the whole curriculum.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CURRICULA, LAUNCH_LANGUAGES, compileCourse, validateCurriculum } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'dist');
mkdirSync(outDir, { recursive: true });

const manifest: Record<string, unknown>[] = [];
let failed = false;

for (const curriculum of CURRICULA) {
  const report = validateCurriculum(curriculum);
  if (report.errors > 0) {
    failed = true;
    console.error(`✗ ${curriculum.languageCode}: ${report.errors} validation errors — not written`);
    for (const issue of report.issues.filter((i) => i.severity === 'error')) {
      console.error(`   ${issue.where}: ${issue.message}`);
    }
    continue;
  }

  const language = LAUNCH_LANGUAGES.find((l) => l.code === curriculum.languageCode);
  const bundle = {
    language,
    courses: curriculum.courses.map((course, index) =>
      compileCourse(course, { languageCode: curriculum.languageCode, ordinal: index + 1 }),
    ),
    vocabulary: curriculum.vocabulary,
    grammar: curriculum.grammar,
    culture: curriculum.culture,
    scenarios: curriculum.scenarios,
    media: curriculum.media,
  };

  const json = JSON.stringify(bundle, null, 2);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 16);
  writeFileSync(join(outDir, `${curriculum.languageCode}.json`), json);

  manifest.push({
    languageCode: curriculum.languageCode,
    hash,
    bytes: json.length,
    ...report.stats,
  });

  console.log(
    `✓ ${curriculum.languageCode}: ${report.stats.lessons} lessons, ` +
      `${report.stats.activities} activities (${(json.length / 1024).toFixed(0)} KB, ${hash})`,
  );
}

writeFileSync(
  join(outDir, 'manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), languages: manifest }, null, 2),
);

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`\nWrote ${manifest.length} bundles to ${outDir}`);
}
