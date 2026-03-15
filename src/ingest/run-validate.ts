import { validateDataDir } from './validate.js';

const result = validateDataDir('data');

if (result.errors.length > 0) {
  console.error('VALIDATION ERRORS:');
  for (const err of result.errors) console.error(`  ✗ ${err}`);
}

if (result.warnings.length > 0) {
  console.warn('WARNINGS:');
  for (const warn of result.warnings) console.warn(`  ⚠ ${warn}`);
}

if (result.fatal) {
  console.error('\nValidation FAILED. Fix errors and retry.');
  process.exit(1);
} else {
  console.log(`\nValidation PASSED (${result.warnings.length} warnings).`);
}
