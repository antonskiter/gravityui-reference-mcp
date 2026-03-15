import type { ComponentDef, TokenSet } from '../types.js';

function groupByLibrary(components: ComponentDef[]): Map<string, ComponentDef[]> {
  const map = new Map<string, ComponentDef[]>();
  for (const c of components) {
    if (!map.has(c.library)) map.set(c.library, []);
    map.get(c.library)!.push(c);
  }
  return map;
}

function formatPropsInterface(component: ComponentDef): string {
  if (component.props.length === 0) return '';
  const lines = [`interface ${component.name}Props {`];
  for (const prop of component.props) {
    const opt = prop.required ? '' : '?';
    const desc = prop.description ? `  // ${prop.description}` : '';
    const def = prop.default ? ` // default: ${prop.default}` : '';
    lines.push(`  ${prop.name}${opt}: ${prop.type};${desc || def}`);
  }
  lines.push('}');
  return lines.join('\n');
}

/**
 * Compact index suitable for llms.txt (~10K tokens or less).
 * Groups components by library and lists names with descriptions.
 * Includes a design token summary.
 */
export function generateLlmsTxt(components: ComponentDef[], tokens: TokenSet): string {
  const sections: string[] = [];

  sections.push('# Gravity UI');
  sections.push('');
  sections.push('> A React-based design system for building cloud interfaces. Includes components, design tokens, and utilities organized across multiple packages.');
  sections.push('');
  sections.push('## Packages');
  sections.push('');
  sections.push('- @gravity-ui/uikit — core UI components (buttons, inputs, modals, etc.)');
  sections.push('- @gravity-ui/components — extended component set');
  sections.push('- @gravity-ui/date-components — date pickers and calendars');
  sections.push('- @gravity-ui/navigation — navigation patterns (sidebar, breadcrumbs)');
  sections.push('- @gravity-ui/markdown-editor — rich markdown editing');
  sections.push('');

  const byLibrary = groupByLibrary(components);

  sections.push('## Components');
  sections.push('');

  for (const [library, libComponents] of byLibrary) {
    const pkg = libComponents[0]?.import_path ?? library;
    sections.push(`### ${pkg}`);
    sections.push('');
    for (const c of libComponents) {
      const desc = c.description ? ` — ${c.description}` : '';
      sections.push(`- **${c.name}**${desc}`);
    }
    sections.push('');
  }

  sections.push('## Design Tokens');
  sections.push('');

  const spacingValues = Object.entries(tokens.spacing).map(([k, v]) => `${k}:${v}`).join(', ');
  if (spacingValues) {
    sections.push(`**Spacing:** ${spacingValues}`);
    sections.push('');
  }

  const breakpointValues = Object.entries(tokens.breakpoints).map(([k, v]) => `${k}:${v}px`).join(', ');
  if (breakpointValues) {
    sections.push(`**Breakpoints:** ${breakpointValues}`);
    sections.push('');
  }

  const sizeValues = Object.entries(tokens.sizes).map(([k, v]) => `${k}:${v}`).join(', ');
  if (sizeValues) {
    sections.push(`**Sizes:** ${sizeValues}`);
    sections.push('');
  }

  if (tokens.colors && Object.keys(tokens.colors).length > 0) {
    const colorValues = Object.entries(tokens.colors).map(([k, v]) => `${k}:${v}`).join(', ');
    sections.push(`**Colors:** ${colorValues}`);
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Full reference suitable for llms-full.txt.
 * For each component: H2, description, import, TypeScript interface, first example.
 * Includes full token values.
 */
export function generateLlmsFullTxt(components: ComponentDef[], tokens: TokenSet): string {
  const sections: string[] = [];

  sections.push('# Gravity UI — Full Component Reference');
  sections.push('');
  sections.push('> Complete component reference for Gravity UI design system. Includes prop interfaces, import statements, and usage examples.');
  sections.push('');

  for (const c of components) {
    sections.push(`## ${c.name}`);
    sections.push('');

    if (c.description) {
      sections.push(c.description);
      sections.push('');
    }

    sections.push(`**Import:** \`${c.import_statement}\``);
    sections.push('');

    const iface = formatPropsInterface(c);
    if (iface) {
      sections.push('```typescript');
      sections.push(iface);
      sections.push('```');
      sections.push('');
    }

    if (c.examples.length > 0) {
      sections.push('**Example:**');
      sections.push('');
      sections.push('```tsx');
      sections.push(c.examples[0]);
      sections.push('```');
      sections.push('');
    }
  }

  sections.push('## Design Tokens');
  sections.push('');

  if (Object.keys(tokens.spacing).length > 0) {
    sections.push('### Spacing');
    sections.push('');
    for (const [key, value] of Object.entries(tokens.spacing)) {
      sections.push(`- spacing-${key}: ${value}`);
    }
    sections.push('');
  }

  if (Object.keys(tokens.breakpoints).length > 0) {
    sections.push('### Breakpoints');
    sections.push('');
    for (const [key, value] of Object.entries(tokens.breakpoints)) {
      sections.push(`- ${key}: ${value}px`);
    }
    sections.push('');
  }

  if (Object.keys(tokens.sizes).length > 0) {
    sections.push('### Sizes');
    sections.push('');
    for (const [key, value] of Object.entries(tokens.sizes)) {
      sections.push(`- size-${key}: ${value}`);
    }
    sections.push('');
  }

  if (tokens.colors && Object.keys(tokens.colors).length > 0) {
    sections.push('### Colors');
    sections.push('');
    for (const [key, value] of Object.entries(tokens.colors)) {
      sections.push(`- ${key}: ${value}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
