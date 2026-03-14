import { searchIndex } from "../../ingest/index.js";
import { levenshtein, tokenizeAndClean } from "../../ingest/tags.js";
import type { LoadedData } from "../loader.js";

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
}

export interface SuggestComponentOutput {
  suggestions: ComponentSuggestion[];
}

const FUZZY_THRESHOLD = 2; // max Levenshtein distance for fuzzy match

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

  // --- Merge scores ---
  const allPageIds = new Set([...tagScores.keys(), ...searchScores.keys()]);
  const combined: { pageId: string; score: number; matchingTags: string[] }[] = [];

  for (const pageId of allPageIds) {
    const tagResult = tagScores.get(pageId);
    const normalizedTagScore = tagResult?.score ?? 0;
    const rawSearchScore = searchScores.get(pageId) ?? 0;
    const normalizedSearchScore = maxSearchScore > 0 ? rawSearchScore / maxSearchScore : 0;

    const finalScore = 0.4 * normalizedTagScore + 0.6 * normalizedSearchScore;

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

    suggestions.push({
      component: page.title,
      library: page.library ?? "",
      page_id: page.id,
      description: page.description,
      matching_tags: entry.matchingTags,
      score: entry.score,
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
    lines.push(`${i + 1}. **${s.component}** (${s.library}) — ${s.score}`);
    lines.push(`   ${s.description}${tags}`);
  });
  return lines.join("\n");
}
