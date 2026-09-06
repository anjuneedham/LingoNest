/**
 * Validates every curriculum and prints a report.
 *
 * Run by `npm run content:validate` and in CI: any error fails the build, so
 * thin or broken content cannot reach a learner.
 */
import { CURRICULA, validateCurriculum } from '../src/index';

let totalErrors = 0;
let totalWarnings = 0;

for (const curriculum of CURRICULA) {
  const report = validateCurriculum(curriculum);
  totalErrors += report.errors;
  totalWarnings += report.warnings;

  const { stats } = report;
  console.log(`\n${curriculum.languageCode.toUpperCase()}`);
  console.log(
    `  ${stats.courses} courses · ${stats.units} units · ${stats.lessons} lessons · ` +
      `${stats.activities} activities · ${stats.activityTypesUsed} activity types`,
  );
  console.log(
    `  ${stats.vocabulary} vocabulary items · ${stats.grammar} grammar topics · ${stats.scenarios} scenarios`,
  );

  for (const issue of report.issues) {
    const marker = issue.severity === 'error' ? '  ✗' : '  !';
    console.log(`${marker} ${issue.where}: ${issue.message}`);
  }

  if (report.issues.length === 0) {
    console.log('  ✓ no issues');
  }
}

console.log(`\n${totalErrors} errors, ${totalWarnings} warnings`);
if (totalErrors > 0) {
  process.exitCode = 1;
}
