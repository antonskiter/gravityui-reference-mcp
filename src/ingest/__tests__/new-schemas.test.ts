import { describe, it, expect } from 'vitest';
import { HookDefSchema, AssetDefSchema, ApiFunctionDefSchema, ConfigDocSchema } from '../../schemas.js';

describe('HookDefSchema', () => {
  it('validates a valid hook', () => {
    const result = HookDefSchema.safeParse({
      name: 'useTheme',
      signature: 'useTheme(): Theme',
      parameters: [{ name: 'options', type: 'ThemeOptions', description: 'Theme config' }],
      return_type: 'Theme',
      import_path: '@gravity-ui/uikit',
      library: 'uikit',
      rules_of_hooks: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a hook missing name', () => {
    const result = HookDefSchema.safeParse({ signature: 'useTheme(): Theme' });
    expect(result.success).toBe(false);
  });
});

describe('AssetDefSchema', () => {
  it('validates a valid asset', () => {
    const result = AssetDefSchema.safeParse({
      name: 'ArrowLeft',
      import_path: '@gravity-ui/icons',
      library: 'icons',
    });
    expect(result.success).toBe(true);
  });
});

describe('ApiFunctionDefSchema', () => {
  it('validates a function export', () => {
    const result = ApiFunctionDefSchema.safeParse({
      name: 'I18n',
      kind: 'class',
      signature: 'class I18n<T>',
      parameters: [],
      import_path: '@gravity-ui/i18n',
      library: 'i18n',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid kind', () => {
    const result = ApiFunctionDefSchema.safeParse({
      name: 'foo',
      kind: 'namespace',
      signature: 'namespace foo',
      parameters: [],
      import_path: '@gravity-ui/i18n',
      library: 'i18n',
    });
    expect(result.success).toBe(false);
  });
});

describe('ConfigDocSchema', () => {
  it('validates a config doc', () => {
    const result = ConfigDocSchema.safeParse({
      library: 'eslint-config',
      npm_package: '@gravity-ui/eslint-config',
      description: 'ESLint config for Gravity UI',
      how_to_use: "extends: ['@gravity-ui/eslint-config']",
      readme: '## Usage\n...',
    });
    expect(result.success).toBe(true);
  });
});
