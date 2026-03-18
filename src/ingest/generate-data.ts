import type { ComponentDef, Page, Chunk } from '../types.js';

function componentPageId(comp: ComponentDef): string {
  return `component:${comp.library}:${comp.name.toLowerCase()}`;
}

export function generatePageFromComponent(comp: ComponentDef): Page {
  const pageId = componentPageId(comp);
  const sectionIds = [
    `${pageId}:description`,
    `${pageId}:props`,
    `${pageId}:import`,
  ];
  if (comp.examples.length > 0) {
    sectionIds.push(`${pageId}:examples`);
  }

  return {
    id: pageId,
    title: comp.name,
    page_type: 'component',
    library: comp.library,
    url: `https://gravity-ui.com/components/${comp.library}/${comp.name.toLowerCase()}`,
    breadcrumbs: [comp.library, comp.name],
    description: comp.description ?? `${comp.name} component from ${comp.library}`,
    section_ids: sectionIds,
  };
}

function formatPropsContent(comp: ComponentDef): string {
  if (comp.props.length === 0) return `${comp.name} has no documented props.`;

  const lines: string[] = [`Props for ${comp.name}:`, ''];
  for (const prop of comp.props) {
    let line = `- ${prop.name}`;
    if (prop.required) line += ' (required)';
    line += `: ${prop.type}`;
    if (prop.default) line += ` — default: ${prop.default}`;
    if (prop.description) line += ` — ${prop.description}`;
    lines.push(line);
  }
  return lines.join('\n');
}

export function generateChunksFromComponent(comp: ComponentDef): Chunk[] {
  const pageId = componentPageId(comp);
  const base = {
    page_id: pageId,
    url: `https://gravity-ui.com/components/${comp.library}/${comp.name.toLowerCase()}`,
    page_title: comp.name,
    page_type: 'component' as const,
    library: comp.library,
    breadcrumbs: [comp.library, comp.name],
    code_examples: [] as string[],
    keywords: [] as string[],
  };

  const chunks: Chunk[] = [];

  // Description chunk
  chunks.push({
    ...base,
    id: `${pageId}:description`,
    section_title: 'Description',
    content: comp.description ?? `${comp.name} component from the ${comp.library} library.`,
  });

  // Props chunk
  chunks.push({
    ...base,
    id: `${pageId}:props`,
    section_title: 'Props',
    content: formatPropsContent(comp),
  });

  // Import chunk
  chunks.push({
    ...base,
    id: `${pageId}:import`,
    section_title: 'Import',
    content: `Import: ${comp.import_statement}\nPackage: ${comp.import_path}`,
  });

  // Examples chunk (if any)
  if (comp.examples.length > 0) {
    chunks.push({
      ...base,
      id: `${pageId}:examples`,
      section_title: 'Examples',
      content: comp.examples.join('\n\n'),
      code_examples: comp.examples,
    });
  }

  return chunks;
}
