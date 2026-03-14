import type { PageManifestEntry } from "../types.js";

const GITHUB_RAW = "https://raw.githubusercontent.com/gravity-ui";
const GITHUB_API = "https://api.github.com/repos/gravity-ui";
interface RepoConfig {
  name: string;
  branch: string;
}

const LIBRARY_REPOS: RepoConfig[] = [
  // Core UI
  "uikit",
  "components",
  "date-components",
  "navigation",
  // Editors & AI
  "markdown-editor",
  "aikit",
  // Data visualization
  "graph",
  "chartkit",
  "charts",
  "table",
  "dashkit",
  "yagr",
  "timeline",
  // Assets
  "icons",
  "illustrations",
  // Forms & constructors
  "dynamic-forms",
  "page-constructor",
  "blog-constructor",
  "page-constructor-builder",
  "dialog-fields",
  // Backend
  "nodekit",
  "expresskit",
  // Layout & navigation
  "app-layout",
  // Utilities
  "date-utils",
  "axios-wrapper",
  "i18n",
  "data-source",
  // Tooling configs
  "eslint-config",
  "tsconfig",
  "prettier-config",
  "stylelint-config",
  "babel-preset",
  { name: "browserslist-config", branch: "master" },
  "webpack-i18n-assets-plugin",
].map((r) => (typeof r === "string" ? { name: r, branch: "main" } : r));
const LANDING_REPO = "landing";
const DESIGN_GUIDE_PREFIX = "src/content/design/guides/content/en/";

interface TreeEntry {
  path: string;
  type: string;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export function buildManifestFromTrees(
  landingTree: TreeEntry[],
  libTrees: Record<string, { tree: TreeEntry[]; branch: string }>,
): PageManifestEntry[] {
  const entries: PageManifestEntry[] = [];

  for (const item of landingTree) {
    if (
      item.type === "blob" &&
      item.path.startsWith(DESIGN_GUIDE_PREFIX) &&
      item.path.endsWith(".mdx")
    ) {
      const name = item.path
        .slice(DESIGN_GUIDE_PREFIX.length)
        .replace(/\.mdx$/, "");
      entries.push({
        raw_url: `${GITHUB_RAW}/${LANDING_REPO}/main/${item.path}`,
        github_url: `https://github.com/gravity-ui/${LANDING_REPO}/blob/main/${item.path}`,
        page_type: "guide",
        name,
      });
    }
  }

  for (const [repo, { tree, branch }] of Object.entries(libTrees)) {
    entries.push({
      raw_url: `${GITHUB_RAW}/${repo}/${branch}/README.md`,
      github_url: `https://github.com/gravity-ui/${repo}`,
      page_type: "library",
      library: repo,
      name: repo,
    });

    for (const item of tree) {
      const match = item.path.match(
        /^src\/components\/(.+)\/README\.md$/,
      );
      if (item.type === "blob" && match) {
        const componentName = match[1];
        entries.push({
          raw_url: `${GITHUB_RAW}/${repo}/${branch}/${item.path}`,
          github_url: `https://github.com/gravity-ui/${repo}/tree/${branch}/src/components/${componentName}`,
          page_type: "component",
          library: repo,
          name: componentName,
        });
      }
    }
  }

  return entries;
}

export async function fetchTree(
  repo: string,
  branch = "main",
): Promise<{ tree: TreeEntry[]; sha: string }> {
  const url = `${GITHUB_API}/${repo}/git/trees/${branch}?recursive=1`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`GitHub API error for ${repo}: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { tree: TreeEntry[]; sha: string };
  return { tree: data.tree, sha: data.sha };
}

export async function discover(): Promise<{
  manifest: PageManifestEntry[];
  commits: Record<string, string>;
}> {
  const commits: Record<string, string> = {};

  console.log("Fetching tree: gravity-ui/landing");
  const landing = await fetchTree(LANDING_REPO);
  commits[LANDING_REPO] = landing.sha;

  const libTrees: Record<string, { tree: TreeEntry[]; branch: string }> = {};
  for (const { name: repo, branch } of LIBRARY_REPOS) {
    console.log(`Fetching tree: gravity-ui/${repo}`);
    const result = await fetchTree(repo, branch);
    libTrees[repo] = { tree: result.tree, branch };
    commits[repo] = result.sha;
  }

  const manifest = buildManifestFromTrees(landing.tree, libTrees);
  console.log(`Discovered ${manifest.length} pages to fetch`);
  return { manifest, commits };
}
