export interface LibraryConfig {
  packageName: string;
  componentPaths: string[];
  flatFiles: boolean;
  moduleBased: boolean;
}

const LIBRARY_CONFIGS: Record<string, Partial<LibraryConfig>> = {
  uikit: {
    componentPaths: [
      'src/components',
      'src/components/layout',
      'src/components/controls',
      'src/components/lab',
    ],
  },
  aikit: {
    componentPaths: [
      'src/components/atoms',
      'src/components/molecules',
      'src/components/organisms',
      'src/components/templates',
      'src/components/pages',
    ],
  },
  graph: {
    componentPaths: ['src/react-components'],
    flatFiles: true,
  },
  'markdown-editor': {
    componentPaths: ['packages/editor/src'],
    moduleBased: true,
  },
  components: {
    componentPaths: ['src/components'],
  },
  'date-components': {
    componentPaths: ['src/components'],
  },
  navigation: {
    componentPaths: ['src/components'],
  },
  table: {
    componentPaths: ['src/components'],
  },
  'page-constructor': {
    componentPaths: ['src/components'],
  },
  dashkit: {
    componentPaths: ['src/components'],
  },
  'dialog-fields': {
    componentPaths: ['src/components'],
  },
  'dynamic-forms': {
    componentPaths: ['src/kit'],
  },
  'blog-constructor': {
    componentPaths: ['src/components'],
  },
  'data-source': {
    componentPaths: ['src/components'],
  },
  timeline: {
    componentPaths: ['src'],
    flatFiles: true,
  },
  chartkit: {
    componentPaths: ['src/components'],
  },
  yagr: {
    componentPaths: ['src'],
    flatFiles: true,
  },
};

export function getLibraryConfig(libraryName: string): LibraryConfig {
  const override = LIBRARY_CONFIGS[libraryName] ?? {};
  return {
    packageName: `@gravity-ui/${libraryName}`,
    componentPaths: override.componentPaths ?? ['src/components'],
    flatFiles: override.flatFiles ?? false,
    moduleBased: override.moduleBased ?? false,
  };
}
