import { describe, it, expect } from 'vitest';
import { handleListComponents, formatListComponents } from '../list-components.js';
import type { ComponentDef, CategoryMap } from '../../../types.js';

function makeTestData() {
  const comps: ComponentDef[] = [
    { name: 'Button', library: 'uikit', import_path: '@gravity-ui/uikit', import_statement: '', props: [], examples: [], description: 'Clickable action element', source_file: '' },
    { name: 'Flex', library: 'uikit', import_path: '@gravity-ui/uikit', import_statement: '', props: [], examples: [], description: 'Flexbox container', source_file: '' },
    { name: 'TextInput', library: 'uikit', import_path: '@gravity-ui/uikit', import_statement: '', props: [], examples: [], description: 'Text input field', source_file: '' },
  ];
  const categoryMap: CategoryMap = {
    categories: { actions: 'Actions', layout: 'Layout', forms: 'Forms' },
    components: { Button: 'actions', Flex: 'layout', TextInput: 'forms' },
  };
  return {
    componentDefs: comps,
    componentsByLibrary: new Map([['uikit', comps]]),
    categoryMap,
  };
}

describe('handleListComponents', () => {
  it('groups by category when no filter', () => {
    const result = handleListComponents(makeTestData() as any, {});
    expect(result.groups.length).toBe(3);
  });

  it('filters by category', () => {
    const result = handleListComponents(makeTestData() as any, { category: 'layout' });
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].components[0].name).toBe('Flex');
  });

  it('filters by library', () => {
    const result = handleListComponents(makeTestData() as any, { library: 'uikit' });
    expect(result.groups.length).toBe(3);
  });
});

describe('formatListComponents', () => {
  it('shows category headers with component counts', () => {
    const result = handleListComponents(makeTestData() as any, {});
    const output = formatListComponents(result);
    expect(output).toContain('Actions');
    expect(output).toContain('Button');
    expect(output).toContain('Layout');
    expect(output).toContain('Flex');
  });

  it('shows descriptions in category-filtered view', () => {
    const result = handleListComponents(makeTestData() as any, { category: 'layout' });
    const output = formatListComponents(result);
    expect(output).toContain('Flexbox container');
  });
});
