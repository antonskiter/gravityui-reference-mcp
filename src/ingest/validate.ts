// src/ingest/validate.ts
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LibraryEntitiesSchema, OverviewSchema, RecipeDefSchema } from '../schemas.js';
import { z } from 'zod';
import type { Entity, Overview } from '../schemas.js';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateDataDir(dataDir: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate entity files
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
          errors.push(`${file}: schema validation failed — ${parsed.error.issues.map(i => i.message).join(', ')}`);
        } else {
          allEntities.push(...parsed.data);
        }
      } catch (e) {
        errors.push(`${file}: failed to parse JSON — ${e}`);
      }
    }
  }

  // Validate overview
  const overviewPath = join(dataDir, 'overview.json');
  let overview: Overview | null = null;
  if (!existsSync(overviewPath)) {
    warnings.push('Missing data/overview.json');
  } else {
    try {
      const raw = JSON.parse(readFileSync(overviewPath, 'utf-8'));
      const parsed = OverviewSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push(`overview.json: schema validation failed — ${parsed.error.issues.map(i => i.message).join(', ')}`);
      } else {
        overview = parsed.data;
      }
    } catch (e) {
      errors.push(`overview.json: failed to parse — ${e}`);
    }
  }

  // Validate recipes
  const recipesPath = join(dataDir, 'recipes.json');
  if (existsSync(recipesPath)) {
    try {
      const raw = JSON.parse(readFileSync(recipesPath, 'utf-8'));
      const parsed = z.array(RecipeDefSchema).safeParse(raw);
      if (!parsed.success) {
        errors.push(`recipes.json: schema validation failed — ${parsed.error.issues.map(i => i.message).join(', ')}`);
      }
    } catch (e) {
      errors.push(`recipes.json: failed to parse — ${e}`);
    }
  }

  // Cross-reference checks
  if (overview) {
    const entityNames = new Set(allEntities.filter(e => e.type === 'component').map(e => e.name));
    for (const [name] of Object.entries(overview.component_categories)) {
      if (!entityNames.has(name)) {
        warnings.push(`overview.component_categories references unknown component: ${name}`);
      }
    }
    for (const entity of allEntities) {
      if (entity.type === 'component' && !overview.component_categories[entity.name]) {
        warnings.push(`Component ${entity.name} (${entity.library}) not categorized in overview`);
      }
    }
  }

  // Check for token-sets
  const hasTokens = allEntities.some(e => e.type === 'token-set');
  if (!hasTokens) {
    warnings.push('No token-set entities found — design tokens may be missing');
  }

  // Check related references
  const allNames = new Set(allEntities.map(e => e.name));
  for (const entity of allEntities) {
    for (const rel of entity.related) {
      if (!allNames.has(rel)) {
        warnings.push(`${entity.name} (${entity.library}) references unknown related entity: ${rel}`);
      }
    }
  }

  return { errors, warnings };
}
