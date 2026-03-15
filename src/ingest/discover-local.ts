import * as fs from 'fs';
import * as path from 'path';
import type { RawPage } from '../types.js';

const GITHUB_RAW = 'https://raw.githubusercontent.com/gravity-ui';
const GITHUB_BLOB = 'https://github.com/gravity-ui';

const LIBRARY_REPOS = [
  'uikit', 'components', 'date-components', 'navigation',
  'markdown-editor', 'aikit', 'graph', 'chartkit', 'charts',
  'table', 'dashkit', 'yagr', 'timeline', 'icons', 'illustrations',
  'dynamic-forms', 'page-constructor', 'blog-constructor',
  'page-constructor-builder', 'dialog-fields', 'nodekit', 'expresskit',
  'app-layout', 'date-utils', 'axios-wrapper', 'i18n', 'data-source',
  'eslint-config', 'tsconfig', 'prettier-config', 'stylelint-config',
  'babel-preset', 'browserslist-config', 'webpack-i18n-assets-plugin',
];

const EXCLUDED_DIRS = new Set([
  '__tests__', '__stories__', '__fixtures__', 'tests',
  'node_modules', '.github', '.storybook', 'examples', 'e2e', 'demo',
]);

const EXCLUDED_FILES = new Set(['CHANGELOG.md', 'CONTRIBUTING.md']);

const LANDING_REPO = 'landing';
const DESIGN_GUIDE_PATH = 'src/content/design/guides/content/en';

function shouldExclude(relPath: string): boolean {
  const parts = relPath.split(path.sep);
  return parts.some(part => EXCLUDED_DIRS.has(part));
}

/**
 * Reads the commit SHA for a submodule by resolving its .git file to the
 * actual git module directory and reading HEAD.
 */
function getSubmoduleCommit(submoduleDir: string): string {
  try {
    const gitFile = path.join(submoduleDir, '.git');
    const gitRef = fs.readFileSync(gitFile, 'utf8').trim();
    // Format: "gitdir: ../../.git/modules/vendor/uikit"
    const match = gitRef.match(/^gitdir:\s*(.+)$/);
    if (!match) return 'unknown';
    const gitdir = path.resolve(submoduleDir, match[1]);
    const headContent = fs.readFileSync(path.join(gitdir, 'HEAD'), 'utf8').trim();
    // Format: "ref: refs/heads/main" or a direct SHA
    if (headContent.startsWith('ref: ')) {
      const refPath = headContent.slice('ref: '.length);
      const refFile = path.join(gitdir, refPath);
      if (fs.existsSync(refFile)) {
        return fs.readFileSync(refFile, 'utf8').trim();
      }
      return 'unknown';
    }
    return headContent;
  } catch {
    return 'unknown';
  }
}

/**
 * Walks a directory recursively and returns all files matching the predicate.
 * Uses fs.readdirSync with recursive option (Node 18+).
 */
function walkFiles(dir: string, predicate: (relPath: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }) as string[];
  return entries.filter(rel => {
    if (!predicate(rel)) return false;
    // Verify it's a file, not a directory
    const full = path.join(dir, rel);
    try {
      return fs.statSync(full).isFile();
    } catch {
      return false;
    }
  });
}

/**
 * Discovers pages from local vendor submodules.
 * Returns all RawPage objects and submodule commit SHAs.
 */
export function discoverLocal(vendorDir: string): {
  pages: RawPage[];
  commits: Record<string, string>;
} {
  const pages: RawPage[] = [];
  const commits: Record<string, string> = {};

  // Discover landing design guides
  const landingDir = path.join(vendorDir, LANDING_REPO);
  commits[LANDING_REPO] = getSubmoduleCommit(landingDir);

  const guideDir = path.join(landingDir, DESIGN_GUIDE_PATH);
  const guideFiles = walkFiles(guideDir, rel => /\.mdx?$/.test(rel) && !rel.includes(path.sep));
  for (const rel of guideFiles) {
    const fullPath = path.join(guideDir, rel);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }
    const name = rel.replace(/\.mdx?$/, '');
    const repoRelPath = `${DESIGN_GUIDE_PATH}/${rel}`;
    pages.push({
      url: `${GITHUB_RAW}/${LANDING_REPO}/main/${repoRelPath}`,
      github_url: `${GITHUB_BLOB}/${LANDING_REPO}/blob/main/${repoRelPath}`,
      content,
      page_type: 'guide',
      name,
    });
  }

  // Discover library repos
  for (const repo of LIBRARY_REPOS) {
    const repoDir = path.join(vendorDir, repo);
    if (!fs.existsSync(repoDir)) continue;

    commits[repo] = getSubmoduleCommit(repoDir);

    // Library root README
    const rootReadme = path.join(repoDir, 'README.md');
    if (fs.existsSync(rootReadme)) {
      let content: string;
      try {
        content = fs.readFileSync(rootReadme, 'utf8');
      } catch {
        content = '';
      }
      pages.push({
        url: `${GITHUB_RAW}/${repo}/main/README.md`,
        github_url: `${GITHUB_BLOB}/${repo}`,
        content,
        page_type: 'library',
        library: repo,
        name: repo,
      });
    }

    // Component READMEs: src/components/*/README.md (one level)
    const componentsDir = path.join(repoDir, 'src', 'components');
    if (fs.existsSync(componentsDir)) {
      const componentFiles = walkFiles(componentsDir, rel => {
        const normalized = rel.split('\\').join('/');
        // Match both flat (ComponentName/README.md) and nested (Category/ComponentName/README.md)
        if (!/README\.md$/.test(normalized)) return false;
        if (shouldExclude(rel)) return false;
        // Skip excluded component subdirectory patterns
        if (/__stories__|__tests__|hooks-public/.test(normalized)) return false;
        return true;
      });

      for (const rel of componentFiles) {
        const normalized = rel.split('\\').join('/');
        const fullPath = path.join(componentsDir, rel);
        let content: string;
        try {
          content = fs.readFileSync(fullPath, 'utf8');
        } catch {
          continue;
        }
        // componentName is the parent directory name of README.md.
        // For nested paths like lab/Menu/README.md, include the category prefix
        // to avoid ID collisions with same-named stable components.
        const parts = normalized.split('/');
        // parts: ['ComponentName', 'README.md'] or ['Category', 'ComponentName', 'README.md']
        const directName = parts[parts.length - 2];
        const componentName = parts.length > 2
          ? `${parts[parts.length - 3]}/${directName}`
          : directName;
        const repoRelPath = `src/components/${normalized}`;
        pages.push({
          url: `${GITHUB_RAW}/${repo}/main/${repoRelPath}`,
          github_url: `${GITHUB_BLOB}/${repo}/tree/main/src/components/${componentName}`,
          content,
          page_type: 'component',
          library: repo,
          name: componentName,
        });
      }
    }

    // Docs directory: docs/**/*.md or docs/**/*.mdx
    const docsDir = path.join(repoDir, 'docs');
    if (fs.existsSync(docsDir)) {
      const docFiles = walkFiles(docsDir, rel => {
        if (!/\.mdx?$/.test(rel)) return false;
        if (shouldExclude(rel)) return false;
        const filename = path.basename(rel);
        if (EXCLUDED_FILES.has(filename)) return false;
        return true;
      });

      for (const rel of docFiles) {
        const normalized = rel.split('\\').join('/');
        const fullPath = path.join(docsDir, rel);
        let content: string;
        try {
          content = fs.readFileSync(fullPath, 'utf8');
        } catch {
          continue;
        }
        const docName = `${repo}/docs/${normalized.replace(/\.mdx?$/, '')}`;
        const repoRelPath = `docs/${normalized}`;
        pages.push({
          url: `${GITHUB_RAW}/${repo}/main/${repoRelPath}`,
          github_url: `${GITHUB_BLOB}/${repo}/blob/main/${repoRelPath}`,
          content,
          page_type: 'library',
          library: repo,
          name: docName,
        });
      }
    }
  }

  return { pages, commits };
}
