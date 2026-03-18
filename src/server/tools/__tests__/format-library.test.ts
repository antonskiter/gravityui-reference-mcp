import { describe, it, expect } from 'vitest';
import { formatLibrary, formatOverview } from '../format-library.js';
import type { LibraryOverviewEntry, DesignSystemOverview } from '../../../types.js';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeLibrary(overrides: Partial<LibraryOverviewEntry> = {}): LibraryOverviewEntry {
  return {
    id: 'uikit',
    package: '@gravity-ui/uikit',
    purpose: 'Core UI components for Gravity.',
    component_count: 42,
    depends_on: [],
    is_peer_dependency_of: [],
    ...overrides,
  };
}

function makeOverview(libraries: LibraryOverviewEntry[] = []): DesignSystemOverview {
  return {
    system: {
      description: 'Gravity UI design system.',
      theming: 'CSS variables',
      spacing: '4px grid',
      typography: 'Inter',
      corner_radius: '4px',
      branding: 'Yandex Cloud',
    },
    libraries,
  };
}

// ---------------------------------------------------------------------------
// formatLibrary
// ---------------------------------------------------------------------------

describe('formatLibrary', () => {
  it('includes library id and package on the first line', () => {
    const result = formatLibrary(makeLibrary());
    expect(result.split('\n')[0]).toBe('uikit (@gravity-ui/uikit)');
  });

  it('prepends @ to package if it is missing', () => {
    const result = formatLibrary(makeLibrary({ package: 'gravity-ui/uikit' }));
    expect(result).toContain('@gravity-ui/uikit');
  });

  it('does not double-prepend @ when package already starts with @', () => {
    const result = formatLibrary(makeLibrary({ package: '@gravity-ui/uikit' }));
    const occurrences = result.split('@@').length - 1;
    expect(occurrences).toBe(0);
    expect(result).toContain('@gravity-ui/uikit');
  });

  it('includes purpose', () => {
    const result = formatLibrary(makeLibrary({ purpose: 'Core UI components for Gravity.' }));
    expect(result).toContain('Core UI components for Gravity.');
  });

  it('includes component count', () => {
    const result = formatLibrary(makeLibrary({ component_count: 42 }));
    expect(result).toContain('42 components');
  });

  it('shows depends_on list when non-empty', () => {
    const result = formatLibrary(makeLibrary({ depends_on: ['uikit', 'icons'] }));
    expect(result).toContain('Depends on: uikit, icons');
  });

  it('shows "none" for depends_on when empty', () => {
    const result = formatLibrary(makeLibrary({ depends_on: [] }));
    expect(result).toContain('Depends on: none');
  });

  it('shows is_peer_dependency_of list when non-empty', () => {
    const result = formatLibrary(makeLibrary({ is_peer_dependency_of: ['chartkit', 'map-kit'] }));
    expect(result).toContain('Used by: chartkit, map-kit');
  });

  it('shows "none" for is_peer_dependency_of when empty', () => {
    const result = formatLibrary(makeLibrary({ is_peer_dependency_of: [] }));
    expect(result).toContain('Used by: none');
  });
});

// ---------------------------------------------------------------------------
// formatOverview
// ---------------------------------------------------------------------------

describe('formatOverview', () => {
  it('starts with "Gravity UI Design System"', () => {
    const result = formatOverview(makeOverview());
    expect(result.split('\n')[0]).toBe('Gravity UI Design System');
  });

  it('includes theming info', () => {
    const result = formatOverview(makeOverview());
    expect(result).toContain('Theming: CSS variables');
  });

  it('includes spacing info', () => {
    const result = formatOverview(makeOverview());
    expect(result).toContain('Spacing: 4px grid');
  });

  it('includes typography info', () => {
    const result = formatOverview(makeOverview());
    expect(result).toContain('Typography: Inter');
  });

  it('includes library count and ids', () => {
    const libs = [
      makeLibrary({ id: 'uikit' }),
      makeLibrary({ id: 'icons', package: '@gravity-ui/icons', component_count: 100 }),
    ];
    const result = formatOverview(makeOverview(libs));
    expect(result).toContain('2 libraries:');
    expect(result).toContain('uikit');
    expect(result).toContain('icons');
  });

  it('shows 0 libraries when none provided', () => {
    const result = formatOverview(makeOverview([]));
    expect(result).toContain('0 libraries:');
  });
});
