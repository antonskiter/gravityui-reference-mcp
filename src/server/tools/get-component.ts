import type { LoadedData } from '../loader.js';
import type { ComponentDef } from '../../types.js';

export interface GetComponentInput {
  name: string;
  library?: string;
  detail?: 'compact' | 'full';
}

export interface GetComponentOutput {
  component?: ComponentDef;
  error?: string;
}

export function handleGetComponent(
  data: LoadedData,
  input: GetComponentInput,
): GetComponentOutput {
  const { name, library } = input;

  let candidates = data.componentByName.get(name) || [];

  // Try case-insensitive if no exact match
  if (candidates.length === 0) {
    for (const [key, vals] of data.componentByName) {
      if (key.toLowerCase() === name.toLowerCase()) {
        candidates = vals;
        break;
      }
    }
  }

  let comp = library
    ? candidates.find(c => c.library === library)
    : candidates[0];

  if (!comp) {
    const available = data.componentDefs
      .map(c => c.name)
      .filter(n => n.toLowerCase().includes(name.toLowerCase()))
      .slice(0, 5);
    const hint = available.length > 0 ? ` Similar: ${available.join(', ')}` : '';
    return { error: `Component not found: ${name}.${hint}` };
  }

  return { component: comp };
}

export function formatGetComponent(output: GetComponentOutput, detail: 'compact' | 'full' = 'compact'): string {
  if (output.error) return output.error;
  const comp = output.component!;

  const lines: string[] = [];

  // Header
  lines.push(`${comp.name} (${comp.import_path})`);
  if (comp.description) lines.push(comp.description);
  lines.push('');

  // Import
  lines.push(comp.import_statement);
  lines.push('');

  // Props as TypeScript interface
  lines.push(`interface ${comp.name}Props {`);
  const propsToShow = detail === 'compact'
    ? comp.props.filter(p => !p.deprecated).slice(0, 20)
    : comp.props;

  for (const prop of propsToShow) {
    const opt = prop.required ? '' : '?';
    const def = prop.default ? ` // default: ${prop.default}` : '';
    const depr = prop.deprecated ? ' // @deprecated' : '';
    const desc = prop.description ? ` — ${prop.description}` : '';
    lines.push(`  ${prop.name}${opt}: ${prop.type};${def}${depr}${desc}`);
  }

  if (detail === 'compact' && comp.props.length > 20) {
    lines.push(`  // ... ${comp.props.length - 20} more props (use detail="full" to see all)`);
  }
  lines.push('}');
  lines.push('');

  // Example
  if (comp.examples.length > 0) {
    lines.push('Example:');
    lines.push(comp.examples[0]);

    if (detail === 'full' && comp.examples.length > 1) {
      for (let i = 1; i < comp.examples.length; i++) {
        lines.push('');
        lines.push(`Example ${i + 1}:`);
        lines.push(comp.examples[i]);
      }
    }
  }

  return lines.join('\n');
}
