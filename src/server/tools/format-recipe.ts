import type { RecipeDef, RecipeSection, RecipeDecisionSection, RecipeComponentsSection, RecipeStructureSection, RecipeExampleSection, RecipeAvoidSection, RecipeRelatedSection } from '../../types.js';
import { codeBlock } from '../text-utils.js';

function getSection<T extends RecipeSection>(recipe: RecipeDef, type: T['type']): T | undefined {
  return recipe.sections.find(s => s.type === type) as T | undefined;
}

function getSections<T extends RecipeSection>(recipe: RecipeDef, type: T['type']): T[] {
  return recipe.sections.filter(s => s.type === type) as T[];
}

export function formatRecipe(recipe: RecipeDef, detail: 'compact' | 'full' = 'compact'): string {
  const lines: string[] = [];

  // Header
  lines.push(`${recipe.title} (${recipe.level})`);
  lines.push(recipe.description);

  // Decision section
  const decision = getSection<RecipeDecisionSection>(recipe, 'decision');
  if (decision) {
    lines.push('');
    lines.push(`When: ${decision.when}`);
    lines.push(`Not for: ${decision.not_for}`);
  }

  // Components section
  const components = getSection<RecipeComponentsSection>(recipe, 'components');
  if (components && components.items.length > 0) {
    lines.push('');
    lines.push('Components:');
    for (const item of components.items) {
      lines.push(`   ${item.name} (${item.library}) [${item.usage}] — ${item.role}`);
    }
  }

  // Install
  if (recipe.packages.length > 0) {
    lines.push('');
    lines.push(`Install: ${recipe.packages.join(' ')}`);
  }

  if (detail === 'full') {
    // Structure section (tree and/or flow)
    const structure = getSection<RecipeStructureSection>(recipe, 'structure');
    if (structure) {
      if (structure.tree && structure.tree.length > 0) {
        lines.push('');
        lines.push('Structure:');
        for (const node of structure.tree) {
          lines.push(`   ${node}`);
        }
      }
      if (structure.flow && structure.flow.length > 0) {
        lines.push('');
        lines.push('Flow:');
        for (const step of structure.flow) {
          lines.push(`   ${step}`);
        }
      }
    }

    // Decision matrix
    if (decision?.matrix && decision.matrix.length > 0) {
      lines.push('');
      lines.push('Decision matrix:');
      for (const entry of decision.matrix) {
        lines.push(`   ${entry.situation} -> ${entry.component} — ${entry.why}`);
      }
    }

    // All examples
    const examples = getSections<RecipeExampleSection>(recipe, 'example');
    for (const example of examples) {
      lines.push('');
      lines.push(`Example: ${example.title}`);
      lines.push(codeBlock('tsx', example.code));
    }

    // Avoid section
    const avoid = getSection<RecipeAvoidSection>(recipe, 'avoid');
    if (avoid && avoid.items.length > 0) {
      lines.push('');
      lines.push('Avoid:');
      for (const item of avoid.items) {
        lines.push(`   ${item}`);
      }
    }

    // Related section
    const related = getSection<RecipeRelatedSection>(recipe, 'related');
    if (related && related.items.length > 0) {
      lines.push('');
      lines.push('Related:');
      for (const item of related.items) {
        lines.push(`   ${item.id} — ${item.note}`);
      }
    }
  }

  return lines.join('\n');
}
