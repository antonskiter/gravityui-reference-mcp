import { describe, it, expect } from 'vitest';
import { getLibraryConfig } from './library-config.js';

describe('getLibraryConfig', () => {
  it('returns uikit config with multiple component paths', () => {
    const cfg = getLibraryConfig('uikit');
    expect(cfg.componentPaths).toContain('src/components');
    expect(cfg.componentPaths).toContain('src/components/layout');
    expect(cfg.packageName).toBe('@gravity-ui/uikit');
  });

  it('returns aikit config with atomic design paths', () => {
    const cfg = getLibraryConfig('aikit');
    expect(cfg.componentPaths).toContain('src/components/atoms');
    expect(cfg.componentPaths).toContain('src/components/molecules');
    expect(cfg.componentPaths).toContain('src/components/organisms');
    expect(cfg.packageName).toBe('@gravity-ui/aikit');
  });

  it('returns graph config with react-components path', () => {
    const cfg = getLibraryConfig('graph');
    expect(cfg.componentPaths).toContain('src/react-components');
    expect(cfg.flatFiles).toBe(true);
  });

  it('returns default config for unknown library', () => {
    const cfg = getLibraryConfig('some-unknown-lib');
    expect(cfg.componentPaths).toEqual(['src/components']);
    expect(cfg.packageName).toBe('@gravity-ui/some-unknown-lib');
  });

  it('returns markdown-editor config with packages/editor/src path', () => {
    const cfg = getLibraryConfig('markdown-editor');
    expect(cfg.componentPaths).toContain('packages/editor/src');
    expect(cfg.moduleBased).toBe(false);
  });
});
