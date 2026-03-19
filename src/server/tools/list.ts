import type { LoadedData } from '../loader.js';
import type { Entity } from '../../schemas.js';

export interface ListInput {
  type?: string;
  category?: string;
  library?: string;
}

export type ListOutput =
  | { kind: 'intro'; total: number; byType: Record<string, number>; byCategory: Record<string, number>; byLibrary: Record<string, number> }
  | { kind: 'entities'; items: Entity[]; filters: ListInput };

export function handleList(data: LoadedData, input: ListInput): ListOutput {
  const hasFilter = input.type || input.category || input.library;

  if (!hasFilter) {
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byLibrary: Record<string, number> = {};

    for (const e of data.entities) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      byLibrary[e.library] = (byLibrary[e.library] ?? 0) + 1;
      if (e.type === 'component' && e.category) {
        byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
      }
    }

    return { kind: 'intro', total: data.entities.length, byType, byCategory, byLibrary };
  }

  let items = data.entities;

  if (input.type) {
    items = items.filter(e => e.type === input.type);
  }
  if (input.library) {
    items = items.filter(e => e.library === input.library);
  }
  if (input.category) {
    const cat = input.category;
    items = items.filter(e =>
      e.type === 'component' && e.category === cat
    );
  }

  return { kind: 'entities', items, filters: input };
}

export function formatList(output: ListOutput): string {
  if (output.kind === 'intro') {
    const lines: string[] = [];
    const libCount = Object.keys(output.byLibrary).length;
    lines.push(`Gravity UI: ${output.total} entities across ${libCount} libraries.`);
    lines.push('');
    lines.push('Filter by:');

    const typeEntries = Object.entries(output.byType).sort((a, b) => b[1] - a[1]);
    if (typeEntries.length > 0) {
      lines.push(`  type: ${typeEntries.map(([t, n]) => `${t} (${n})`).join(', ')}`);
    }

    const catEntries = Object.entries(output.byCategory).sort((a, b) => b[1] - a[1]);
    if (catEntries.length > 0) {
      lines.push(`  category: ${catEntries.map(([c, n]) => `${c} (${n})`).join(', ')}`);
    }

    const libEntries = Object.entries(output.byLibrary).sort((a, b) => b[1] - a[1]);
    if (libEntries.length > 0) {
      lines.push(`  library: ${libEntries.map(([l, n]) => `${l} (${n})`).join(', ')}`);
    }

    lines.push('');
    lines.push('Example: list(type="component", category="forms")');

    return lines.join('\n');
  }

  // Filtered entity list
  if (output.items.length === 0) {
    const parts: string[] = ['No entities found'];
    const f = output.filters;
    if (f.library) parts.push(`library "${f.library}"`);
    if (f.type) parts.push(`type "${f.type}"`);
    if (f.category) parts.push(`category "${f.category}"`);
    return parts.length > 1
      ? `${parts[0]} for ${parts.slice(1).join(', ')}. Check spelling or try list() to see available options.`
      : `${parts[0]}. Try list() to see available options.`;
  }

  const lines: string[] = [];
  for (const e of output.items) {
    const lib = e.library ? ` (${e.library})` : '';
    lines.push(`${e.name} [${e.type}]${lib} — ${e.description}`);
    if (e.when_to_use.length > 0) lines.push(`  Use: ${e.when_to_use.join('; ')}`);
    if (e.avoid.length > 0) lines.push(`  Avoid: ${e.avoid.join('; ')}`);
  }
  return lines.join('\n');
}
