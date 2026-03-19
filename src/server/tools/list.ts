import type { LoadedData } from '../loader.js';
import type { Entity } from '../../schemas.js';

export interface ListInput {
  type?: string;
  category?: string;
  library?: string;
}

export type ListOutput =
  | { kind: 'summary'; total: number; byType: Record<string, number>; byLibrary: Record<string, number>; categories: Record<string, string>; recipeCount: number }
  | { kind: 'entities'; items: Entity[]; filters: ListInput };

export function handleList(data: LoadedData, input: ListInput): ListOutput {
  const hasFilter = input.type || input.category || input.library;

  if (!hasFilter) {
    const byType: Record<string, number> = {};
    const byLibrary: Record<string, number> = {};
    for (const e of data.entities) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      byLibrary[e.library] = (byLibrary[e.library] ?? 0) + 1;
    }
    return {
      kind: 'summary',
      total: data.entities.length,
      byType,
      byLibrary,
      categories: data.overview.categories,
      recipeCount: data.recipes.length,
    };
  }

  let items = data.entities;

  if (input.type) {
    items = items.filter(e => e.type === input.type);
  }
  if (input.library) {
    items = items.filter(e => e.library === input.library);
  }
  if (input.category) {
    const compCats = data.overview.component_categories;
    items = items.filter(e => compCats[e.name] === input.category);
  }

  return { kind: 'entities', items, filters: input };
}

export function formatList(output: ListOutput): string {
  if (output.kind === 'summary') {
    const lines: string[] = [];
    lines.push(`Gravity UI: ${output.total} entities, ${output.recipeCount} recipes\n`);

    lines.push('By type:');
    for (const [type, count] of Object.entries(output.byType).sort((a, b) => b[1] - a[1])) {
      lines.push(`   ${type}: ${count}`);
    }
    lines.push('');

    lines.push('By library:');
    for (const [lib, count] of Object.entries(output.byLibrary).sort((a, b) => b[1] - a[1])) {
      lines.push(`   ${lib}: ${count}`);
    }
    lines.push('');

    if (Object.keys(output.categories).length > 0) {
      lines.push('Categories:');
      for (const [slug, desc] of Object.entries(output.categories)) {
        lines.push(`   ${slug}: ${desc}`);
      }
    }

    return lines.join('\n').trim();
  }

  // Filtered entity list
  const lines: string[] = [];
  const filterDesc = [
    output.filters.type,
    output.filters.library,
    output.filters.category,
  ].filter(Boolean).join(', ');
  lines.push(`${output.items.length} results${filterDesc ? ` (${filterDesc})` : ''}:\n`);

  for (const e of output.items) {
    lines.push(`[${e.type}] ${e.name} (${e.library}) — ${e.description}`);
  }

  return lines.join('\n').trim();
}
