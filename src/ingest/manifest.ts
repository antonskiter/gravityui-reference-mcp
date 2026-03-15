import * as fs from 'fs';
import * as path from 'path';

export interface ManifestComponent {
  name: string;
  readme_path: string;
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
 * Discovers components for a library: directories under {libDir}/src/components/
 * that start with an uppercase letter and contain a README.md.
 */
function discoverComponents(libDir: string): ManifestComponent[] {
  const componentsDir = path.join(libDir, 'src', 'components');
  if (!fs.existsSync(componentsDir)) return [];

  let componentDirs: string[];
  try {
    componentDirs = fs.readdirSync(componentsDir, { encoding: 'utf8' }).filter(entry => {
      // Must start with uppercase
      if (!/^[A-Z]/.test(entry)) return false;
      // Must be a directory
      try {
        return fs.statSync(path.join(componentsDir, entry)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }

  const components: ManifestComponent[] = [];

  for (const compName of componentDirs) {
    const compDir = path.join(componentsDir, compName);
    const readmePath = path.join(compDir, 'README.md');
    if (!fs.existsSync(readmePath)) continue;

    // Relative readme path from libDir
    const readmeRelPath = path.join('src', 'components', compName, 'README.md');

    // Source files: *.ts, *.tsx — excluding excluded dirs
    const sourceFiles = walkFiles(compDir, rel => {
      if (isExcluded(rel)) return false;
      return /\.(ts|tsx)$/.test(rel) && !/\.stories\.(ts|tsx)$/.test(rel);
    }).map(rel => path.join('src', 'components', compName, rel));

    // Story files: *.stories.ts, *.stories.tsx
    const storyFiles = walkFiles(compDir, rel => {
      if (isExcluded(rel)) return false;
      return /\.stories\.(ts|tsx)$/.test(rel);
    }).map(rel => path.join('src', 'components', compName, rel));

    // SCSS files: *.scss — excluding excluded dirs
    const scssFiles = walkFiles(compDir, rel => {
      if (isExcluded(rel)) return false;
      return /\.scss$/.test(rel);
    }).map(rel => path.join('src', 'components', compName, rel));

    components.push({
      name: compName,
      readme_path: readmeRelPath,
      source_paths: sourceFiles.sort(),
      story_paths: storyFiles.sort(),
      scss_paths: scssFiles.sort(),
    });
  }

  return components.sort((a, b) => a.name.localeCompare(b.name));
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

    const components = discoverComponents(libDir);
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
