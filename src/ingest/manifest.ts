import * as fs from 'fs';
import * as path from 'path';
import { getLibraryConfig } from './library-config.js';

export const ALL_LIBRARIES: Array<{
  id: string;
  npmPackage: string;
  category: 'component' | 'asset' | 'utility' | 'config';
}> = [
  // Component libraries
  { id: 'uikit',                    npmPackage: '@gravity-ui/uikit',                    category: 'component' },
  { id: 'aikit',                    npmPackage: '@gravity-ui/aikit',                    category: 'component' },
  { id: 'components',               npmPackage: '@gravity-ui/components',               category: 'component' },
  { id: 'date-components',          npmPackage: '@gravity-ui/date-components',          category: 'component' },
  { id: 'navigation',               npmPackage: '@gravity-ui/navigation',               category: 'component' },
  { id: 'table',                    npmPackage: '@gravity-ui/table',                    category: 'component' },
  { id: 'page-constructor',         npmPackage: '@gravity-ui/page-constructor',         category: 'component' },
  { id: 'dashkit',                  npmPackage: '@gravity-ui/dashkit',                  category: 'component' },
  { id: 'dialog-fields',            npmPackage: '@gravity-ui/dialog-fields',            category: 'component' },
  { id: 'dynamic-forms',            npmPackage: '@gravity-ui/dynamic-forms',            category: 'component' },
  { id: 'blog-constructor',         npmPackage: '@gravity-ui/blog-constructor',         category: 'component' },
  { id: 'data-source',              npmPackage: '@gravity-ui/data-source',              category: 'component' },
  { id: 'timeline',                 npmPackage: '@gravity-ui/timeline',                 category: 'component' },
  { id: 'chartkit',                 npmPackage: '@gravity-ui/chartkit',                 category: 'component' },
  { id: 'yagr',                     npmPackage: '@gravity-ui/yagr',                     category: 'component' },
  { id: 'charts',                   npmPackage: '@gravity-ui/charts',                   category: 'component' },
  { id: 'graph',                    npmPackage: '@gravity-ui/graph',                    category: 'component' },
  { id: 'markdown-editor',          npmPackage: '@gravity-ui/markdown-editor',          category: 'component' },
  // Asset libraries
  { id: 'icons',                    npmPackage: '@gravity-ui/icons',                    category: 'asset' },
  { id: 'illustrations',            npmPackage: '@gravity-ui/illustrations',            category: 'asset' },
  // Utility libraries
  { id: 'i18n',                     npmPackage: '@gravity-ui/i18n',                     category: 'utility' },
  { id: 'date-utils',               npmPackage: '@gravity-ui/date-utils',               category: 'utility' },
  { id: 'axios-wrapper',            npmPackage: '@gravity-ui/axios-wrapper',            category: 'utility' },
  { id: 'app-layout',               npmPackage: '@gravity-ui/app-layout',               category: 'utility' },
  // Config / tooling
  { id: 'eslint-config',            npmPackage: '@gravity-ui/eslint-config',            category: 'config' },
  { id: 'tsconfig',                 npmPackage: '@gravity-ui/tsconfig',                 category: 'config' },
  { id: 'prettier-config',          npmPackage: '@gravity-ui/prettier-config',          category: 'config' },
  { id: 'stylelint-config',         npmPackage: '@gravity-ui/stylelint-config',         category: 'config' },
  { id: 'babel-preset',             npmPackage: '@gravity-ui/babel-preset',             category: 'config' },
  { id: 'browserslist-config',      npmPackage: '@gravity-ui/browserslist-config',      category: 'config' },
  { id: 'webpack-i18n-assets-plugin', npmPackage: '@gravity-ui/webpack-i18n-assets-plugin', category: 'config' },
  { id: 'page-constructor-builder', npmPackage: '@gravity-ui/page-constructor-builder', category: 'config' },
];

export interface ManifestComponent {
  name: string;
  readme_path?: string;  // optional — README enriches but is not required
  source_paths: string[];
  story_paths: string[];
  scss_paths: string[];
}

export interface ManifestBatch {
  batch_id: string;
  components: ManifestComponent[];
}

export interface ManifestEntry {
  library: string;
  git_sha: string;
  changed: boolean;
  batches: ManifestBatch[];
}

export interface Manifest {
  entries: ManifestEntry[];
  timestamp: string;
}

const BATCH_SIZE = 10;

const EXCLUDED_DIRS = new Set([
  '__tests__', '__stories__', '__fixtures__', 'tests',
  'node_modules', '.github', '.storybook', 'examples', 'e2e', 'demo',
]);

/**
 * Reads the git SHA for a submodule directory.
 * Handles both cases:
 * - .git file pointing to gitdir (typical submodule): "gitdir: ../../.git/modules/vendor/uikit"
 * - .git directory with HEAD directly
 */
function readGitSha(libDir: string): string {
  try {
    const gitPath = path.join(libDir, '.git');
    if (!fs.existsSync(gitPath)) return 'unknown';

    const stat = fs.statSync(gitPath);

    let gitdir: string;
    if (stat.isFile()) {
      // Submodule: .git is a file like "gitdir: ../../.git/modules/vendor/uikit"
      const content = fs.readFileSync(gitPath, 'utf8').trim();
      const match = content.match(/^gitdir:\s*(.+)$/);
      if (!match) return 'unknown';
      gitdir = path.resolve(libDir, match[1]);
    } else {
      // Regular git repo: .git is a directory
      gitdir = gitPath;
    }

    const headFile = path.join(gitdir, 'HEAD');
    if (!fs.existsSync(headFile)) return 'unknown';

    const headContent = fs.readFileSync(headFile, 'utf8').trim();

    if (headContent.startsWith('ref: ')) {
      const refPath = headContent.slice('ref: '.length);
      const refFile = path.join(gitdir, refPath);
      if (fs.existsSync(refFile)) {
        const sha = fs.readFileSync(refFile, 'utf8').trim();
        return sha.slice(0, 12);
      }
      return 'unknown';
    }

    // Detached HEAD — content is the SHA itself
    return headContent.slice(0, 12);
  } catch {
    return 'unknown';
  }
}

/**
 * Returns true if any segment of the given relative path matches an excluded dir.
 */
function isExcluded(relPath: string): boolean {
  const parts = relPath.split(path.sep);
  return parts.some(part => EXCLUDED_DIRS.has(part));
}

/**
 * Recursively walks a directory and returns relative file paths passing predicate.
 */
function walkFiles(dir: string, predicate: (rel: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }) as string[];
  return entries.filter(rel => {
    if (!predicate(rel)) return false;
    try {
      return fs.statSync(path.join(dir, rel)).isFile();
    } catch {
      return false;
    }
  });
}

/**
 * Splits an array into batches of at most batchSize items.
 */
function batch<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Discovers components for a library using library-config to determine scan paths and mode.
 *
 * - moduleBased libraries return [] (e.g. markdown-editor)
 * - flatFiles libraries scan for .tsx files beginning with uppercase (e.g. graph, timeline, yagr)
 * - directory-based libraries scan for sub-directories beginning with uppercase
 *
 * README.md is optional: present → readme_path set; absent → component still included.
 * Components are deduplicated by name when multiple componentPaths overlap.
 */
function discoverComponents(libDir: string, libraryName: string): ManifestComponent[] {
  const config = getLibraryConfig(libraryName);

  if (config.moduleBased) return [];

  const byName = new Map<string, ManifestComponent>();

  for (const componentPath of config.componentPaths) {
    const scanDir = path.join(libDir, componentPath);
    if (!fs.existsSync(scanDir)) continue;

    if (config.flatFiles) {
      // Flat mode: each uppercase .tsx file in scanDir is a component
      let files: string[];
      try {
        files = fs.readdirSync(scanDir, { encoding: 'utf8' }).filter(entry => {
          if (!/^[A-Z]/.test(entry)) return false;
          if (!/\.tsx$/.test(entry)) return false;
          try {
            return fs.statSync(path.join(scanDir, entry)).isFile();
          } catch {
            return false;
          }
        });
      } catch {
        continue;
      }

      for (const fileName of files) {
        const compName = fileName.replace(/\.tsx$/, '');
        if (byName.has(compName)) continue;

        const relBase = path.join(componentPath, fileName);

        byName.set(compName, {
          name: compName,
          // No README expected for flat-file components
          source_paths: [relBase],
          story_paths: [],
          scss_paths: [],
        });
      }
    } else {
      // Directory mode: each uppercase sub-directory is a component
      let dirs: string[];
      try {
        dirs = fs.readdirSync(scanDir, { encoding: 'utf8' }).filter(entry => {
          if (!/^[A-Z]/.test(entry)) return false;
          try {
            return fs.statSync(path.join(scanDir, entry)).isDirectory();
          } catch {
            return false;
          }
        });
      } catch {
        continue;
      }

      for (const compName of dirs) {
        // Skip if already discovered from an earlier componentPath
        if (byName.has(compName)) continue;

        const compDir = path.join(scanDir, compName);
        const readmePath = path.join(compDir, 'README.md');
        const readmeRelPath = fs.existsSync(readmePath)
          ? path.join(componentPath, compName, 'README.md')
          : undefined;

        // Source files: *.ts, *.tsx — excluding excluded dirs and story files
        const sourceFiles = walkFiles(compDir, rel => {
          if (isExcluded(rel)) return false;
          return /\.(ts|tsx)$/.test(rel) && !/\.stories\.(ts|tsx)$/.test(rel);
        }).map(rel => path.join(componentPath, compName, rel));

        // Story files: *.stories.ts, *.stories.tsx
        const storyFiles = walkFiles(compDir, rel => {
          if (isExcluded(rel)) return false;
          return /\.stories\.(ts|tsx)$/.test(rel);
        }).map(rel => path.join(componentPath, compName, rel));

        // SCSS files: *.scss — excluding excluded dirs
        const scssFiles = walkFiles(compDir, rel => {
          if (isExcluded(rel)) return false;
          return /\.scss$/.test(rel);
        }).map(rel => path.join(componentPath, compName, rel));

        const component: ManifestComponent = {
          name: compName,
          source_paths: sourceFiles.sort(),
          story_paths: storyFiles.sort(),
          scss_paths: scssFiles.sort(),
        };
        if (readmeRelPath !== undefined) {
          component.readme_path = readmeRelPath;
        }

        byName.set(compName, component);
      }
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Builds a Manifest by discovering vendor/ submodules, reading git SHAs,
 * comparing with previous SHAs, and batching components for parallel processing.
 *
 * @param vendorDir  Path to the vendor directory (may be relative to cwd)
 * @param previousShas  Map of library name → previously recorded SHA (first 12 chars or full)
 */
export function buildManifest(
  vendorDir: string,
  previousShas: Record<string, string>,
): Manifest {
  const resolvedVendorDir = path.resolve(vendorDir);

  if (!fs.existsSync(resolvedVendorDir)) {
    return { entries: [], timestamp: new Date().toISOString() };
  }

  // Discover submodule directories: direct children of vendorDir not starting with "."
  let libNames: string[];
  try {
    libNames = fs.readdirSync(resolvedVendorDir, { encoding: 'utf8' }).filter(entry => {
      if (entry.startsWith('.')) return false;
      try {
        return fs.statSync(path.join(resolvedVendorDir, entry)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    libNames = [];
  }

  libNames.sort();

  const entries: ManifestEntry[] = [];

  for (const libName of libNames) {
    const libDir = path.join(resolvedVendorDir, libName);
    const gitSha = readGitSha(libDir);

    const prevSha = previousShas[libName];
    // Compare: previousSha may be full SHA, gitSha is 12 chars
    // Normalize: compare by checking if the longer one starts with the shorter one
    const changed = !prevSha || (!prevSha.startsWith(gitSha) && !gitSha.startsWith(prevSha));

    const components = discoverComponents(libDir, libName);
    const batches = batch(components, BATCH_SIZE).map((batchComponents, idx) => ({
      batch_id: `${libName}-batch-${idx + 1}`,
      components: batchComponents,
    }));

    entries.push({
      library: libName,
      git_sha: gitSha,
      changed,
      batches,
    });
  }

  return {
    entries,
    timestamp: new Date().toISOString(),
  };
}
