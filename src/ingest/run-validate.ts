// src/ingest/run-validate.ts
import { validateDataDir } from './validate.js';

const result = validateDataDir('data');

if (result.warnings.length > 0) {
  console.log(`Warnings (${result.warnings.length}):`);
  for (const w of result.warnings) console.log(`  ⚠ ${w}`);
}

if (result.errors.length > 0) {
  console.log(`\nErrors (${result.errors.length}):`);
  for (const e of result.errors) console.log(`  ✗ ${e}`);
  process.exit(1);
} else {
  console.log(`\n✓ Validation passed (${result.warnings.length} warnings)`);
}
