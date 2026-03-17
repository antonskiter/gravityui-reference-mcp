import type { LoadedData } from '../loader.js';
import type { RecipeDef } from '../../types.js';
import { tokenizeAndClean, levenshtein } from './suggest-component.js';
import { handleSuggestComponent } from './suggest-component.js';
import { handleSearchDocs, truncateAtWord } from './search-docs.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FindInput {
  query: string;
}

export interface RecipeCard {
  id: string;
  level: string;
  description: string;
  componentNames: string[];  // from sections[type=components].items[].name
  score: number;
}

export interface ComponentCard {
  name: string;
  library: string;
  description: string;
  score: number;
}

export interface DocCard {
  pageTitle: string;
  sectionTitle: string;
  snippet: string;  // max 100 chars
}

export interface FindOutput {
  recipes: RecipeCard[];
  components: ComponentCard[];
  docs: DocCard[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const FUZZY_THRESHOLD = 2;

function scoreRecipe(queryTokens: string[], recipe: RecipeDef): number {
  const recipeTokens = [
    ...recipe.use_cases.flatMap(uc => tokenizeAndClean(uc)),
    ...recipe.tags.flatMap(t => tokenizeAndClean(t)),
  ];
  if (recipeTokens.length === 0) return 0;

  let matchCount = 0;
  for (const qt of queryTokens) {
    for (const rt of recipeTokens) {
      if (rt === qt) { matchCount++; break; }
      if (qt.length >= 4 && rt.length >= 4 && levenshtein(qt, rt) <= FUZZY_THRESHOLD) {
        matchCount += 0.5; break;
      }
    }
  }
  return matchCount / queryTokens.length;
}

function extractComponentNames(recipe: RecipeDef): string[] {
  for (const section of recipe.sections) {
    if (section.type === 'components') {
      return section.items.map(item => item.name);
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export function handleFind(data: LoadedData, input: FindInput): FindOutput {
  const { query } = input;
  const queryTokens = tokenizeAndClean(query);

  // --- Recipes ---
  const recipeScores: { recipe: RecipeDef; score: number }[] = [];
  if (queryTokens.length > 0) {
    for (const recipe of data.recipes) {
      const score = scoreRecipe(queryTokens, recipe);
      if (score > 0) recipeScores.push({ recipe, score });
    }
  }
  recipeScores.sort((a, b) => b.score - a.score);
  const recipes: RecipeCard[] = recipeScores.slice(0, 2).map(({ recipe, score }) => ({
    id: recipe.id,
    level: recipe.level,
    description: recipe.description,
    componentNames: extractComponentNames(recipe),
    score: Math.round(score * 100) / 100,
  }));

  // --- Components ---
  const suggestResult = handleSuggestComponent(data, { use_case: query, limit: 3 });
  const components: ComponentCard[] = suggestResult.suggestions.map(s => ({
    name: s.component,
    library: s.library,
    description: s.description,
    score: s.score,
  }));

  // --- Docs ---
  const docsResult = handleSearchDocs(data, { query, limit: 2 });
  const docs: DocCard[] = docsResult.results.map(r => ({
    pageTitle: r.page_title,
    sectionTitle: r.section_title,
    snippet: truncateAtWord(r.snippet, 100),
  }));

  return { recipes, components, docs };
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

export function formatFind(output: FindOutput): string {
  const total = output.recipes.length + output.components.length + output.docs.length;
  const lines: string[] = [`${total} results`];

  for (const r of output.recipes) {
    const comps = r.componentNames.length > 0
      ? `\n   Components: ${r.componentNames.join(', ')}`
      : '';
    lines.push(`[recipe] ${r.id} (${r.level})`);
    lines.push(`   ${r.description}${comps}`);
  }

  for (const c of output.components) {
    lines.push(`[component] ${c.name} (${c.library}) ${Math.round(c.score * 100)}`);
    lines.push(`   ${c.description}`);
  }

  for (const d of output.docs) {
    lines.push(`[doc] ${d.pageTitle} — ${d.sectionTitle}`);
    lines.push(`   ${d.snippet}`);
  }

  return lines.join('\n');
}
