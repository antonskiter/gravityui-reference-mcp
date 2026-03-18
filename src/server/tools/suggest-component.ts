import { searchIndex } from "../../ingest/index.js";
import type { LoadedData } from "../loader.js";
import type { ComponentDef } from "../../types.js";
import { indent } from "../format.js";

// ---------------------------------------------------------------------------
// String utilities (previously in ingest/tags.ts, inlined after pipeline cleanup)
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "in", "of", "to", "for",
  "with", "on", "at", "by", "is", "it", "its", "be", "as",
  "are", "was", "were", "that", "this", "from", "up", "how",
  "can", "you", "use", "used", "using", "component", "components",
]);

export function tokenizeAndClean(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s_/,.:;()]+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export interface SuggestComponentInput {
  use_case: string;
  library?: string;
  limit?: number;
}

interface ComponentSuggestion {
  component: string;
  library: string;
  page_id: string;
  description: string;
  matching_tags: string[];
  score: number;
  import_statement?: string;
}

export interface SuggestComponentOutput {
  suggestions: ComponentSuggestion[];
}

const FUZZY_THRESHOLD = 2; // max Levenshtein distance for fuzzy match

function computeDefScore(queryTokens: string[], def: ComponentDef): number {
  if (queryTokens.length === 0) return 0;

  // Build a token bag from description + prop names
  const defTokens: string[] = [];
  if (def.description) {
    defTokens.push(...tokenizeAndClean(def.description));
  }
  for (const prop of def.props ?? []) {
    defTokens.push(...tokenizeAndClean(prop.name));
  }

  if (defTokens.length === 0) return 0;

  let matchCount = 0;
  for (const token of queryTokens) {
    for (const defToken of defTokens) {
      if (defToken === token) {
        matchCount++;
        break;
      }
      if (token.length >= 4 && defToken.length >= 4 && levenshtein(token, defToken) <= FUZZY_THRESHOLD) {
        matchCount += 0.5;
        break;
      }
    }
  }

  return matchCount / queryTokens.length;
}

function computeTagScore(
  queryTokens: string[],
  tags: string[],
): { score: number; matchingTags: string[] } {
  if (queryTokens.length === 0) return { score: 0, matchingTags: [] };

  const matchingTags: string[] = [];
  let matchCount = 0;

  for (const token of queryTokens) {
    for (const tag of tags) {
      if (tag === token) {
        matchCount++;
        if (!matchingTags.includes(tag)) matchingTags.push(tag);
        break;
      }
      if (token.length >= 4 && tag.length >= 4 && levenshtein(token, tag) <= FUZZY_THRESHOLD) {
        matchCount += 0.5; // partial credit for fuzzy
        if (!matchingTags.includes(tag)) matchingTags.push(tag);
        break;
      }
    }
  }

  return {
    score: matchCount / queryTokens.length,
    matchingTags,
  };
}

export function handleSuggestComponent(
  data: LoadedData,
  input: SuggestComponentInput,
): SuggestComponentOutput {
  const { use_case, library, limit = 3 } = input;
  const queryTokens = tokenizeAndClean(use_case);

  if (queryTokens.length === 0) {
    return { suggestions: [] };
  }

  // --- Tag-based scoring ---
  const tagScores = new Map<string, { score: number; matchingTags: string[] }>();
  for (const [pageId, tags] of data.tagsByPageId) {
    if (library) {
      const page = data.pageById.get(pageId);
      if (!page || page.library !== library) continue;
    }
    const result = computeTagScore(queryTokens, tags);
    if (result.score > 0) {
      tagScores.set(pageId, result);
    }
  }

  // --- MiniSearch-based scoring ---
  const searchResults = searchIndex(data.index, use_case, 50);
  const searchScores = new Map<string, number>();
  let maxSearchScore = 0;

  for (const result of searchResults) {
    const chunk = data.chunkById.get(result.id);
    if (!chunk || chunk.page_type !== "component") continue;
    if (library && chunk.library !== library) continue;

    const pageId = chunk.page_id;
    const current = searchScores.get(pageId) ?? 0;
    if (result.score > current) {
      searchScores.set(pageId, result.score);
      if (result.score > maxSearchScore) maxSearchScore = result.score;
    }
  }

  // --- ComponentDef-based scoring ---
  // Build a map from (name+library) key -> best def score + import_statement
  const defScores = new Map<string, { score: number; import_statement: string }>();
  for (const def of data.componentDefs) {
    if (library && def.library !== library) continue;
    const score = computeDefScore(queryTokens, def);
    if (score <= 0) continue;
    const key = `${def.name}::${def.library}`;
    const existing = defScores.get(key);
    if (!existing || score > existing.score) {
      defScores.set(key, { score, import_statement: def.import_statement });
    }
  }

  // Map def scores to page IDs via componentByName
  const defScoresByPageId = new Map<string, { score: number; import_statement: string }>();
  for (const [key, defResult] of defScores) {
    const [compName, compLib] = key.split("::");
    // Find pages that match this component name + library
    for (const [pageId, page] of data.pageById) {
      if (page.library !== compLib) continue;
      if (page.title !== compName) continue;
      const existing = defScoresByPageId.get(pageId);
      if (!existing || defResult.score > existing.score) {
        defScoresByPageId.set(pageId, defResult);
      }
    }
  }

  // --- Merge scores ---
  const allPageIds = new Set([
    ...tagScores.keys(),
    ...searchScores.keys(),
    ...defScoresByPageId.keys(),
  ]);
  const combined: { pageId: string; score: number; matchingTags: string[] }[] = [];

  for (const pageId of allPageIds) {
    const tagResult = tagScores.get(pageId);
    const normalizedTagScore = tagResult?.score ?? 0;
    const rawSearchScore = searchScores.get(pageId) ?? 0;
    const normalizedSearchScore = maxSearchScore > 0 ? rawSearchScore / maxSearchScore : 0;
    const defResult = defScoresByPageId.get(pageId);
    const normalizedDefScore = defResult?.score ?? 0;

    // Weights: 30% tag + 50% search + 20% def
    const finalScore = 0.3 * normalizedTagScore + 0.5 * normalizedSearchScore + 0.2 * normalizedDefScore;

    if (finalScore > 0) {
      combined.push({
        pageId,
        score: Math.round(finalScore * 100) / 100,
        matchingTags: tagResult?.matchingTags ?? [],
      });
    }
  }

  // Sort by score descending
  combined.sort((a, b) => b.score - a.score);

  // Build suggestions
  const suggestions: ComponentSuggestion[] = [];
  for (const entry of combined.slice(0, limit)) {
    const page = data.pageById.get(entry.pageId);
    if (!page) continue;

    const defResult = defScoresByPageId.get(entry.pageId);

    suggestions.push({
      component: page.title,
      library: page.library ?? "",
      page_id: page.id,
      description: page.description,
      matching_tags: entry.matchingTags,
      score: entry.score,
      import_statement: defResult?.import_statement,
    });
  }

  return { suggestions };
}

export function formatSuggestComponent(result: SuggestComponentOutput): string {
  const { suggestions } = result;
  if (suggestions.length === 0) return "No suggestions found.";
  const lines: string[] = [];
  suggestions.forEach((s, i) => {
    const tags = s.matching_tags.length > 0 ? `\n   Tags: ${s.matching_tags.join(", ")}` : "";
    const importLine = s.import_statement ? `\n   Import: ${s.import_statement}` : "";
    lines.push(`${i + 1}. ${s.component} (${s.library}) ${Math.round(s.score * 100)}`);
    lines.push(`${indent(s.description)}${tags}${importLine}`);
  });
  return lines.join("\n");
}
