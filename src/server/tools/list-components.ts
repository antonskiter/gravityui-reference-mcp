import type { LoadedData } from '../loader.js';

export interface ListComponentsInput {
  library?: string;
  category?: string;
}

interface ComponentSummary {
  name: string;
  library: string;
  description?: string;
}

interface CategoryGroup {
  category: string;
  displayName: string;
  components: ComponentSummary[];
}

export interface ListComponentsOutput {
  groups: CategoryGroup[];
  totalCount: number;
}

export function handleListComponents(
  data: LoadedData,
  input: ListComponentsInput,
): ListComponentsOutput {
  let comps = data.componentDefs;

  if (input.library) {
    comps = data.componentsByLibrary.get(input.library) || [];
  }

  const grouped = new Map<string, ComponentSummary[]>();
  for (const comp of comps) {
    const catSlug = data.categoryMap.components[comp.name] || 'other';
    if (input.category && catSlug !== input.category) continue;

    if (!grouped.has(catSlug)) grouped.set(catSlug, []);
    grouped.get(catSlug)!.push({
      name: comp.name,
      library: comp.library,
      description: comp.description,
    });
  }

  const groups: CategoryGroup[] = [];
  for (const [slug, components] of grouped) {
    const displayName = data.categoryMap.categories[slug] || slug;
    groups.push({ category: slug, displayName, components });
  }

  groups.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const totalCount = groups.reduce((sum, g) => sum + g.components.length, 0);
  return { groups, totalCount };
}

export function formatListComponents(output: ListComponentsOutput): string {
  const lines: string[] = [];
  const isFiltered = output.groups.length === 1;

  // Detect names that appear in multiple libraries so we can disambiguate
  const nameCounts = new Map<string, number>();
  for (const group of output.groups) {
    for (const comp of group.components) {
      nameCounts.set(comp.name, (nameCounts.get(comp.name) || 0) + 1);
    }
  }

  lines.push(`${output.totalCount} components`);
  lines.push('');

  for (const group of output.groups) {
    lines.push(`${group.displayName} (${group.components.length})`);

    for (const comp of group.components) {
      const displayName = (nameCounts.get(comp.name) || 0) > 1
        ? `${comp.name} (${comp.library})`
        : comp.name;
      if (isFiltered && comp.description) {
        lines.push(`  ${displayName} — ${comp.description}`);
      } else {
        lines.push(`  ${displayName}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
