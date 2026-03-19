import { searchEntities } from '../index-builder.js';
import type { LoadedData } from '../loader.js';
import type { Entity } from '../../schemas.js';

export interface GetInput {
  name: string;
  type?: string;
  library?: string;
  detail?: 'compact' | 'full';
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

  // Fuzzy fallback via search
  const results = searchEntities(data.index, input.name.trim(), { limit: 5 });
  const suggestions = results.map(r => r.name);

  return { type: 'not_found', name: input.name.trim(), suggestions };
}

export function formatGet(output: GetOutput, detail: 'compact' | 'full' = 'compact'): string {
  if (output.type === 'not_found') {
    return formatNotFound(output.name, output.suggestions);
  }

  return output.entities
    .map(e => formatEntity(e, detail))
    .join('\n---\n');
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

  if (entity.type === 'component') {
    const props = detail === 'compact' ? entity.props.slice(0, 5) : entity.props;
    if (props.length > 0) {
      lines.push('Props:');
      for (const p of props) {
        let line = `   ${p.name}`;
        if (p.required) line += ' (required)';
        line += `: ${p.type}`;
        if (p.default) line += ` = ${p.default}`;
        if (p.description) line += ` — ${p.description}`;
        lines.push(line);
      }
      if (detail === 'compact' && entity.props.length > 5) {
        lines.push(`   ... and ${entity.props.length - 5} more`);
      }
      lines.push('');
    }
    const examples = detail === 'compact' ? entity.examples.slice(0, 1) : entity.examples;
    if (examples.length > 0) {
      lines.push('Examples:');
      for (const ex of examples) {
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
    const examples = detail === 'compact' ? entity.examples.slice(0, 1) : entity.examples;
    if (examples.length > 0) {
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
    const entries = Object.entries(entity.values);
    const show = detail === 'compact' ? entries.slice(0, 10) : entries;
    lines.push('Values:');
    for (const [k, v] of show) {
      lines.push(`   ${k}: ${v}`);
    }
    if (detail === 'compact' && entries.length > 10) {
      lines.push(`   ... and ${entries.length - 10} more`);
    }
    lines.push('');
  }

  if (entity.type === 'recipe') {
    const decision = entity.sections.find(s => s.type === 'decision');
    if (decision && decision.type === 'decision' && decision.when_to_use.length > 0) {
      lines.push('When to use:');
      for (const w of decision.when_to_use) lines.push(`   - ${w}`);
      lines.push('');
    }
    if (detail === 'full') {
      if (decision && decision.type === 'decision' && decision.when_not_to_use.length > 0) {
        lines.push('Not for:');
        for (const w of decision.when_not_to_use) lines.push(`   - ${w}`);
        lines.push('');
      }
    }
    const exampleSections = entity.sections.filter(s => s.type === 'example');
    const examples = detail === 'compact' ? exampleSections.slice(0, 1) : exampleSections;
    for (const s of examples) {
      if (s.type === 'example') {
        lines.push(`Example: ${s.title}`);
        lines.push('```tsx');
        lines.push(s.code);
        lines.push('```');
        lines.push('');
      }
    }
    if (detail === 'full') {
      const compSection = entity.sections.find(s => s.type === 'components');
      if (compSection && compSection.type === 'components') {
        lines.push('Components:');
        for (const c of compSection.items) {
          lines.push(`   ${c.name} (${c.library}) — ${c.role} [${c.usage}]`);
        }
        lines.push('');
      }
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
