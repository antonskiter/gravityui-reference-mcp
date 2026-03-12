import type { PageManifestEntry } from "../types.js";

const GITHUB_RAW = "https://raw.githubusercontent.com/gravity-ui";
const GITHUB_API = "https://api.github.com/repos/gravity-ui";
const LIBRARY_REPOS = ["uikit", "components", "date-components", "navigation"];
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
  libTrees: Record<string, TreeEntry[]>,
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

  for (const [repo, tree] of Object.entries(libTrees)) {
    entries.push({
      raw_url: `${GITHUB_RAW}/${repo}/main/README.md`,
      github_url: `https://github.com/gravity-ui/${repo}`,
      page_type: "library",
      library: repo,
      name: repo,
    });

    for (const item of tree) {
      const match = item.path.match(
        /^src\/components\/([^/]+)\/README\.md$/,
      );
      if (item.type === "blob" && match) {
        const componentName = match[1];
        entries.push({
          raw_url: `${GITHUB_RAW}/${repo}/main/${item.path}`,
          github_url: `https://github.com/gravity-ui/${repo}/tree/main/src/components/${componentName}`,
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
): Promise<{ tree: TreeEntry[]; sha: string }> {
  const url = `${GITHUB_API}/${repo}/git/trees/main?recursive=1`;
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

  const libTrees: Record<string, TreeEntry[]> = {};
  for (const repo of LIBRARY_REPOS) {
    console.log(`Fetching tree: gravity-ui/${repo}`);
    const result = await fetchTree(repo);
    libTrees[repo] = result.tree;
    commits[repo] = result.sha;
  }

  const manifest = buildManifestFromTrees(landing.tree, libTrees);
  console.log(`Discovered ${manifest.length} pages to fetch`);
  return { manifest, commits };
}
