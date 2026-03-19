import { searchEntities } from '../index-builder.js';
import type { LoadedData } from '../loader.js';
import type { Entity, RecipeDef, Overview } from '../../schemas.js';

export interface GetInput {
  name: string;
  detail?: 'compact' | 'full';
}

export type GetOutput =
  | { type: 'entity'; entity: Entity }
  | { type: 'recipe'; recipe: RecipeDef }
  | { type: 'overview'; overview: Overview }
  | { type: 'not_found'; name: string; suggestions: string[] };

export function handleGet(data: LoadedData, input: GetInput): GetOutput {
  const name = input.name.trim();

  // Overview
  if (name.toLowerCase() === 'overview') {
    return { type: 'overview', overview: data.overview };
  }

  // Exact match by name (case-insensitive)
  for (const [key, entities] of data.entityByName) {
    if (key.toLowerCase() === name.toLowerCase()) {
      return { type: 'entity', entity: entities[0] };
    }
  }

  // Recipe by id or title
  for (const recipe of data.recipes) {
    if (recipe.id === name.toLowerCase() || recipe.title.toLowerCase() === name.toLowerCase()) {
      return { type: 'recipe', recipe };
    }
  }

  // Fuzzy fallback via search
  const results = searchEntities(data.index, name, { limit: 5 });
  const suggestions = results.map(r => r.name);

  return { type: 'not_found', name, suggestions };
}

export function formatGet(output: GetOutput, detail: 'compact' | 'full' = 'compact'): string {
  switch (output.type) {
    case 'overview':
      return formatOverview(output.overview);
    case 'recipe':
      return formatRecipe(output.recipe, detail);
    case 'entity':
      return formatEntity(output.entity, detail);
    case 'not_found':
      return formatNotFound(output.name, output.suggestions);
  }
}

function formatEntity(entity: Entity, detail: 'compact' | 'full'): string {
  const lines: string[] = [];
  lines.push(`${entity.name} [${entity.type}] (${entity.library})`);
  lines.push(entity.description);
  lines.push('');

  if (entity.import_statement) {
    lines.push(`Import: ${entity.import_statement}`);
    lines.push('');
  }

  if (detail === 'full' && entity.when_to_use.length > 0) {
    lines.push('When to use:');
    for (const u of entity.when_to_use) lines.push(`   - ${u}`);
    lines.push('');
  }

  if (detail === 'full' && entity.avoid.length > 0) {
    lines.push('Avoid:');
    for (const a of entity.avoid) lines.push(`   - ${a}`);
    lines.push('');
  }

  if (entity.type === 'component' || entity.type === 'hook' || entity.type === 'utility') {
    const e = entity as Entity & { props?: unknown[]; signature?: string; examples?: string[] };
    if ('props' in e && Array.isArray(e.props) && e.props.length > 0) {
      const props = detail === 'compact' ? e.props.slice(0, 15) : e.props;
      lines.push('Props:');
      for (const p of props as Array<{ name: string; type: string; required: boolean; default?: string; description?: string }>) {
        let line = `   ${p.name}`;
        if (p.required) line += ' (required)';
        line += `: ${p.type}`;
        if (p.default) line += ` = ${p.default}`;
        if (p.description) line += ` — ${p.description}`;
        lines.push(line);
      }
      if (detail === 'compact' && e.props.length > 15) {
        lines.push(`   ... and ${e.props.length - 15} more`);
      }
      lines.push('');
    }
    if ('signature' in e && e.signature) {
      lines.push(`Signature: ${e.signature}`);
      lines.push('');
    }
    if ('examples' in e && Array.isArray(e.examples) && e.examples.length > 0) {
      const examples = detail === 'compact' ? e.examples.slice(0, 1) : e.examples;
      lines.push('Examples:');
      for (const ex of examples) {
        lines.push('```tsx');
        lines.push(ex);
        lines.push('```');
        lines.push('');
      }
    }
  }

  if (entity.type === 'token-set') {
    const e = entity as Entity & { values: Record<string, unknown> };
    lines.push('Values:');
    const entries = Object.entries(e.values);
    const show = detail === 'compact' ? entries.slice(0, 10) : entries;
    for (const [k, v] of show) {
      lines.push(`   ${k}: ${v}`);
    }
    if (detail === 'compact' && entries.length > 10) {
      lines.push(`   ... and ${entries.length - 10} more`);
    }
    lines.push('');
  }

  if (entity.related.length > 0) {
    lines.push(`Related: ${entity.related.join(', ')}`);
  }

  return lines.join('\n').trim();
}

function formatRecipe(recipe: RecipeDef, detail: 'compact' | 'full'): string {
  const lines: string[] = [];
  lines.push(`${recipe.title} [recipe] (${recipe.level})`);
  lines.push(recipe.description);
  lines.push('');

  if (recipe.use_cases.length > 0) {
    lines.push('Use cases:');
    for (const u of recipe.use_cases) lines.push(`   - ${u}`);
    lines.push('');
  }

  for (const section of recipe.sections) {
    if (section.type === 'decision') {
      if (section.when_to_use.length > 0) {
        lines.push('When to use:');
        for (const w of section.when_to_use) lines.push(`   - ${w}`);
        lines.push('');
      }
    }
    if (section.type === 'example' && (detail === 'full' || recipe.sections.filter(s => s.type === 'example').indexOf(section) === 0)) {
      lines.push(`Example: ${section.title}`);
      lines.push('```tsx');
      lines.push(section.code);
      lines.push('```');
      lines.push('');
    }
    if (section.type === 'components' && detail === 'full') {
      lines.push('Components:');
      for (const c of section.items) {
        lines.push(`   ${c.name} (${c.library}) — ${c.role} [${c.usage}]`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

function formatOverview(overview: Overview): string {
  const lines: string[] = [];
  lines.push('Gravity UI Design System');
  lines.push(overview.system.description);
  lines.push('');

  if (overview.libraries.length > 0) {
    lines.push('Libraries:');
    for (const lib of overview.libraries) {
      lines.push(`   ${lib.id} (${lib.package}) — ${lib.purpose} [${lib.component_count} components]`);
    }
    lines.push('');
  }

  if (Object.keys(overview.categories).length > 0) {
    lines.push('Categories:');
    for (const [slug, desc] of Object.entries(overview.categories)) {
      lines.push(`   ${slug}: ${desc}`);
    }
  }

  return lines.join('\n').trim();
}

function formatNotFound(name: string, suggestions: string[]): string {
  const lines = [`"${name}" not found.`];
  if (suggestions.length > 0) {
    lines.push('');
    lines.push('Did you mean:');
    for (const s of suggestions) lines.push(`   - ${s}`);
  }
  return lines.join('\n');
}
