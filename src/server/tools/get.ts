import type { LoadedData } from '../loader.js';
import type { Entity } from '../../schemas.js';

export interface GetInput {
  name: string;
  type?: string;
  library?: string;
}

export type GetOutput =
  | { type: 'found'; entities: Entity[] }
  | { type: 'not_found'; name: string; suggestions: string[] };

export function handleGet(data: LoadedData, input: GetInput): GetOutput {
  const name = input.name.trim().toLowerCase();

  let matches = data.entityByName.get(name) ?? [];

  if (input.type) {
    matches = matches.filter(e => e.type === input.type);
  }
  if (input.library) {
    matches = matches.filter(e => e.library === input.library);
  }

  if (matches.length > 0) {
    return { type: 'found', entities: matches };
  }

  // Fuzzy fallback for suggestions (typo correction)
  const fuzzyResults = data.index.search(input.name.trim(), { fuzzy: 0.3, prefix: true });
  const suggestions = [...new Set(fuzzyResults.slice(0, 5).map(r => r.name as string))];

  return { type: 'not_found', name: input.name.trim(), suggestions };
}

export function formatGet(output: GetOutput): string {
  if (output.type === 'not_found') {
    return formatNotFound(output.name, output.suggestions);
  }

  return output.entities
    .map(e => formatEntity(e))
    .join('\n---\n');
}

function formatEntity(entity: Entity): string {
  const lines: string[] = [];
  const lib = entity.library ? ` (${entity.library})` : '';
  lines.push(`${entity.name} [${entity.type}]${lib}`);
  lines.push(entity.description);
  lines.push('');

  if (entity.import_statement) {
    lines.push(`Import: ${entity.import_statement}`);
    lines.push('');
  }

  if (entity.when_to_use.length > 0) {
    lines.push('When to use:');
    for (const u of entity.when_to_use) lines.push(`   - ${u}`);
    lines.push('');
  }

  if (entity.avoid.length > 0) {
    lines.push('Avoid:');
    for (const a of entity.avoid) lines.push(`   - ${a}`);
    lines.push('');
  }

  if (entity.type === 'component') {
    if (entity.props.length > 0) {
      lines.push('Props:');
      for (const p of entity.props) {
        let line = `   ${p.name}`;
        if (p.required) line += ' (required)';
        line += `: ${p.type}`;
        if (p.default) line += ` = ${p.default}`;
        if (p.description) line += ` — ${p.description}`;
        lines.push(line);
      }
      lines.push('');
    }
    if (entity.examples.length > 0) {
      lines.push('Examples:');
      for (const ex of entity.examples) {
        lines.push('```tsx');
        lines.push(ex);
        lines.push('```');
        lines.push('');
      }
    }
  }

  if (entity.type === 'hook' || entity.type === 'utility') {
    if (entity.signature) {
      lines.push(`Signature: ${entity.signature}`);
      lines.push('');
    }
    if (entity.examples.length > 0) {
      lines.push('Examples:');
      for (const ex of entity.examples) {
        lines.push('```tsx');
        lines.push(ex);
        lines.push('```');
        lines.push('');
      }
    }
  }

  if (entity.type === 'token-set') {
    const entries = Object.entries(entity.values);
    lines.push('Values:');
    for (const [k, v] of entries) {
      lines.push(`   ${k}: ${v}`);
    }
    lines.push('');
  }

  if (entity.type === 'recipe') {
    // decision section is already shown as entity-level when_to_use/avoid
    const exampleSections = entity.sections.filter(s => s.type === 'example');
    for (const s of exampleSections) {
      if (s.type === 'example') {
        lines.push(`Example: ${s.title}`);
        lines.push('```tsx');
        lines.push(s.code);
        lines.push('```');
        lines.push('');
      }
    }
    const compSection = entity.sections.find(s => s.type === 'components');
    if (compSection && compSection.type === 'components') {
      lines.push('Components:');
      for (const c of compSection.items) {
        lines.push(`   ${c.name} (${c.library}) — ${c.role} [${c.usage}]`);
      }
      lines.push('');
    }
  }

  if (entity.type === 'library') {
    if (entity.not_for) {
      lines.push(`Not for: ${entity.not_for}`);
      lines.push('');
    }
    if (entity.depends_on.length > 0) {
      lines.push(`Depends on: ${entity.depends_on.join(', ')}`);
    }
  }

  if (entity.related.length > 0) {
    lines.push(`Related: ${entity.related.join(', ')}`);
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
