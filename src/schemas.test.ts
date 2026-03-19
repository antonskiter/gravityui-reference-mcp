import { describe, it, expect } from 'vitest';
import {
  EntitySchema, PropDefSchema,
  type Entity, type PropDef,
} from './schemas.js';

describe('PropDefSchema', () => {
  it('validates a complete prop', () => {
    const result = PropDefSchema.safeParse({
      name: 'size',
      type: "'s' | 'm' | 'l'",
      required: false,
      default: "'m'",
      description: 'Button size',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = PropDefSchema.safeParse({ type: 'string', required: true });
    expect(result.success).toBe(false);
  });
});

describe('EntitySchema', () => {
  it('validates a component entity', () => {
    const result = EntitySchema.safeParse({
      type: 'component',
      name: 'Button',
      library: 'uikit',
      description: 'A versatile button component.',
      keywords: ['button', 'action', 'click'],
      when_to_use: ['Trigger actions', 'Submit forms'],
      avoid: ['For navigation, use Link instead'],
      import_statement: "import {Button} from '@gravity-ui/uikit';",
      related: ['ButtonGroup', 'Icon'],
      props: [{ name: 'size', type: "'s' | 'm' | 'l'", required: false }],
      examples: ['<Button size="m">Click</Button>'],
    });
    expect(result.success).toBe(true);
  });

  it('validates a hook entity', () => {
    const result = EntitySchema.safeParse({
      type: 'hook',
      name: 'useTheme',
      library: 'uikit',
      description: 'Access the current theme.',
      keywords: ['theme', 'dark', 'light'],
      when_to_use: ['Read current theme in components'],
      import_statement: "import {useTheme} from '@gravity-ui/uikit';",
      signature: '() => ThemeType',
      return_type: 'ThemeType',
    });
    expect(result.success).toBe(true);
  });

  it('validates a token-set entity', () => {
    const result = EntitySchema.safeParse({
      type: 'token-set',
      name: 'spacing',
      library: 'uikit',
      description: 'Spacing scale based on 4px grid.',
      keywords: ['spacing', 'gap', 'margin', 'padding'],
      when_to_use: ['Consistent spacing between elements'],
      import_statement: '',
      values: { '0': '0px', '1': '4px', '2': '8px' },
    });
    expect(result.success).toBe(true);
  });

  it('validates an asset entity', () => {
    const result = EntitySchema.safeParse({
      type: 'asset',
      name: 'Calendar',
      library: 'icons',
      description: 'Calendar icon.',
      keywords: ['calendar', 'date', 'schedule'],
      when_to_use: ['Date-related UI'],
      import_statement: "import {Calendar} from '@gravity-ui/icons';",
      category: 'date',
    });
    expect(result.success).toBe(true);
  });

  it('validates a utility entity', () => {
    const result = EntitySchema.safeParse({
      type: 'utility',
      name: 'configure',
      library: 'i18n',
      description: 'Configure i18n instance.',
      keywords: ['i18n', 'locale', 'translation'],
      when_to_use: ['Set up internationalization'],
      import_statement: "import {configure} from '@gravity-ui/i18n';",
      signature: '(config: I18nConfig) => I18n',
      parameters: [{ name: 'config', type: 'I18nConfig', description: 'Configuration object' }],
    });
    expect(result.success).toBe(true);
  });

  it('validates a config-doc entity', () => {
    const result = EntitySchema.safeParse({
      type: 'config-doc',
      name: 'eslint-config',
      library: 'eslint-config',
      description: 'Shared ESLint configuration.',
      keywords: ['eslint', 'linting', 'code quality'],
      when_to_use: ['Set up linting in a GravityUI project'],
      import_statement: '',
      how_to_use: 'Extend in .eslintrc: { "extends": "@gravity-ui/eslint-config" }',
    });
    expect(result.success).toBe(true);
  });

  it('validates a guide entity', () => {
    const result = EntitySchema.safeParse({
      type: 'guide',
      name: 'Getting Started with NodeKit',
      library: 'nodekit',
      description: 'Server-side framework setup guide.',
      keywords: ['server', 'nodejs', 'setup'],
      when_to_use: ['Building server-side applications'],
      import_statement: "import {NodeKit} from '@gravity-ui/nodekit';",
      content: 'NodeKit provides a structured way to build Node.js services...',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown entity type', () => {
    const result = EntitySchema.safeParse({
      type: 'unknown',
      name: 'Foo',
      library: 'bar',
      description: 'test',
      keywords: [],
      when_to_use: [],
      import_statement: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('library entity', () => {
  it('validates a library entity', () => {
    const result = EntitySchema.safeParse({
      type: 'library',
      name: 'uikit',
      library: 'uikit',
      description: 'Core UI component library.',
      keywords: ['components', 'ui', 'design-system'],
      when_to_use: ['Building GravityUI-based interfaces'],
      avoid: ['Do not use for server-side code'],
      import_statement: "import {Button} from '@gravity-ui/uikit';",
      related: ['navigation'],
      package: '@gravity-ui/uikit',
      not_for: 'Charts or data visualization',
      depends_on: [],
      is_peer_dependency_of: ['navigation'],
      component_count: 70,
    });
    expect(result.success).toBe(true);
  });

  it('validates a library entity with defaults', () => {
    const result = EntitySchema.safeParse({
      type: 'library',
      name: 'date-utils',
      library: 'date-utils',
      description: 'Date utility functions.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keywords).toEqual([]);
      expect(result.data.component_count).toBe(0);
      expect(result.data.package).toBe('');
    }
  });
});

describe('recipe entity', () => {
  it('validates a recipe entity', () => {
    const result = EntitySchema.safeParse({
      type: 'recipe',
      name: 'confirmation-dialog',
      title: 'Confirmation Dialog',
      description: 'Pattern for confirming destructive actions.',
      library: 'uikit',
      keywords: ['dialog', 'confirmation', 'modal'],
      when_to_use: ['Destructive actions requiring confirmation'],
      avoid: ['Simple info messages'],
      packages: ['@gravity-ui/uikit'],
      level: 'molecule',
      components: [{ name: 'Dialog', library: 'uikit', role: 'Container' }],
      sections: [
        { type: 'decision', when_to_use: ['Destructive actions'], when_not_to_use: ['Simple info'] },
        { type: 'example', title: 'Basic', code: '<Dialog open={open}>...</Dialog>' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('validates a recipe entity with defaults', () => {
    const result = EntitySchema.safeParse({
      type: 'recipe',
      name: 'simple-form',
      title: 'Simple Form',
      description: 'Basic form pattern.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.library).toBe('');
      expect(result.data.sections).toEqual([]);
      expect(result.data.components).toEqual([]);
    }
  });
});
