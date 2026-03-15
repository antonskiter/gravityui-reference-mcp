import { describe, it, expect } from 'vitest';
import { handleGetComponent, formatGetComponent } from './get-component.js';
import type { ComponentDef } from '../../types.js';

function makeTestData() {
  const buttonDef: ComponentDef = {
    name: 'Button',
    library: 'uikit',
    import_path: '@gravity-ui/uikit',
    import_statement: "import {Button} from '@gravity-ui/uikit';",
    props: [
      { name: 'size', type: "'xs' | 's' | 'm' | 'l' | 'xl'", required: false, default: "'m'" },
      { name: 'view', type: "'normal' | 'action' | 'outlined' | 'flat'", required: false },
      { name: 'disabled', type: 'boolean', required: false },
      { name: 'loading', type: 'boolean', required: false },
    ],
    examples: ['<Button size="l" view="action">Submit</Button>'],
    description: 'A clickable element for triggering actions',
    source_file: 'src/components/Button/Button.tsx',
  };

  return {
    componentByName: new Map([['Button', [buttonDef]]]),
    componentsByLibrary: new Map([['uikit', [buttonDef]]]),
    componentDefs: [buttonDef],
  };
}

describe('handleGetComponent', () => {
  it('returns component data by name', () => {
    const data = makeTestData();
    const result = handleGetComponent(data as any, { name: 'Button' });
    expect(result).toBeDefined();
    expect(result.component).toBeDefined();
    expect(result.component!.name).toBe('Button');
  });

  it('returns error for unknown component', () => {
    const data = makeTestData();
    const result = handleGetComponent(data as any, { name: 'Nonexistent' });
    expect(result.error).toBeDefined();
  });
});

describe('formatGetComponent', () => {
  it('formats compact output with TypeScript interface', () => {
    const data = makeTestData();
    const result = handleGetComponent(data as any, { name: 'Button' });
    const output = formatGetComponent(result);
    expect(output).toContain("import {Button} from '@gravity-ui/uikit'");
    expect(output).toContain("size?:");
    expect(output).toContain("'xs' | 's' | 'm' | 'l' | 'xl'");
    expect(output).toContain('<Button');
  });
});
