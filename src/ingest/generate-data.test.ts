import { describe, it, expect } from 'vitest';
import { generatePageFromComponent, generateChunksFromComponent } from './generate-data.js';
import type { ComponentDef } from '../types.js';

const flexComponent: ComponentDef = {
  name: 'Flex',
  library: 'uikit',
  import_path: '@gravity-ui/uikit',
  import_statement: "import { Flex } from '@gravity-ui/uikit';",
  props: [
    { name: 'gap', type: 'number', required: false, description: 'Gap between items' },
    { name: 'direction', type: "'row' | 'column'", required: false, default: "'row'" },
  ],
  examples: [],
  description: 'A flexible box layout component',
  source_file: 'src/components/layout/Flex/Flex.tsx',
};

describe('generatePageFromComponent', () => {
  it('creates a page with correct id and type', () => {
    const page = generatePageFromComponent(flexComponent);
    expect(page.id).toBe('component:uikit:flex');
    expect(page.page_type).toBe('component');
    expect(page.library).toBe('uikit');
    expect(page.title).toBe('Flex');
    expect(page.breadcrumbs).toEqual(['uikit', 'Flex']);
  });

  it('generates section_ids for description, props, import', () => {
    const page = generatePageFromComponent(flexComponent);
    expect(page.section_ids).toContain('component:uikit:flex:description');
    expect(page.section_ids).toContain('component:uikit:flex:props');
    expect(page.section_ids).toContain('component:uikit:flex:import');
  });
});

describe('generateChunksFromComponent', () => {
  it('creates description chunk', () => {
    const chunks = generateChunksFromComponent(flexComponent);
    const desc = chunks.find(c => c.id.endsWith(':description'));
    expect(desc).toBeDefined();
    expect(desc!.content).toContain('flexible box layout');
  });

  it('creates props chunk with prop details', () => {
    const chunks = generateChunksFromComponent(flexComponent);
    const propsChunk = chunks.find(c => c.id.endsWith(':props'));
    expect(propsChunk).toBeDefined();
    expect(propsChunk!.content).toContain('gap');
    expect(propsChunk!.content).toContain('direction');
  });

  it('creates import chunk', () => {
    const chunks = generateChunksFromComponent(flexComponent);
    const importChunk = chunks.find(c => c.id.endsWith(':import'));
    expect(importChunk).toBeDefined();
    expect(importChunk!.content).toContain("@gravity-ui/uikit");
  });

  it('all chunks reference the correct page_id', () => {
    const chunks = generateChunksFromComponent(flexComponent);
    for (const chunk of chunks) {
      expect(chunk.page_id).toBe('component:uikit:flex');
    }
  });
});
