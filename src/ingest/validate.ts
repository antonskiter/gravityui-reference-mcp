// src/ingest/validate.ts
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LibraryEntitiesSchema } from '../schemas.js';
import type { Entity } from '../schemas.js';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateDataDir(dataDir: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate entity files (including _system.json and _recipes.json)
  const entitiesDir = join(dataDir, 'entities');
  const allEntities: Entity[] = [];

  if (!existsSync(entitiesDir)) {
    warnings.push('Missing data/entities/ directory — run extraction first');
  } else {
    const files = readdirSync(entitiesDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
      warnings.push('No entity files found in data/entities/ — run extraction first');
    }
    for (const file of files) {
      const filePath = join(entitiesDir, file);
      try {
        const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
        const parsed = LibraryEntitiesSchema.safeParse(raw);
        if (!parsed.success) {
          errors.push(`${file}: schema validation failed — ${parsed.error.issues.slice(0, 3).map(i => `[${i.path.join('.')}] ${i.message}`).join('; ')}`);
        } else {
          allEntities.push(...parsed.data);
        }
      } catch (e) {
        errors.push(`${file}: failed to parse JSON — ${e}`);
      }
    }

    // _system.json must exist
    if (!files.includes('_system.json')) {
      warnings.push('Missing data/entities/_system.json — run overview agent first');
    }

    // _recipes.json must exist
    if (!files.includes('_recipes.json')) {
      warnings.push('Missing data/entities/_recipes.json — run recipes agent first');
    }
  }

  // Check token-sets
  const hasTokens = allEntities.some(e => e.type === 'token-set');
  if (!hasTokens) {
    warnings.push('No token-set entities found — design tokens may be missing');
  }

  // Cross-reference: related entity names must exist
  const allNames = new Set(allEntities.map(e => e.name));
  for (const entity of allEntities) {
    for (const rel of entity.related) {
      if (!allNames.has(rel)) {
        warnings.push(`${entity.name} (${entity.library}) references unknown related entity: ${rel}`);
      }
    }
  }

  // Cross-reference: every component entity should have a category field
  for (const entity of allEntities) {
    if (entity.type === 'component' && !('category' in entity && entity.category)) {
      warnings.push(`Component ${entity.name} (${entity.library}) is missing a category — run overview agent`);
    }
  }

  return { errors, warnings };
}
