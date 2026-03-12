import type { LoadedData } from "../loader.js";

export interface ListComponentsInput {
  library?: string;
}

export interface ComponentEntry {
  page_id: string;
  name: string;
  library: string;
  url: string;
  description: string;
  has_design_guide: boolean;
}

export interface ComponentsByLibrary {
  [library: string]: ComponentEntry[];
}

export interface ListComponentsOutput {
  components_by_library: ComponentsByLibrary;
  total: number;
}

export function handleListComponents(
  data: LoadedData,
  input: ListComponentsInput,
): ListComponentsOutput {
  const { library } = input;

  // Filter component pages, optionally by library
  const componentPages = data.pages.filter(p => {
    if (p.page_type !== "component") return false;
    if (library && p.library !== library) return false;
    return true;
  });

  // Build a set of guide page names (lowercased) for lookup
  const guideNames = new Set<string>();
  for (const p of data.pages) {
    if (p.page_type === "guide") {
      guideNames.add(p.title.toLowerCase());
    }
  }

  const componentsByLibrary: ComponentsByLibrary = {};

  for (const page of componentPages) {
    const lib = page.library ?? "unknown";
    if (!componentsByLibrary[lib]) {
      componentsByLibrary[lib] = [];
    }

    const has_design_guide = guideNames.has(page.title.toLowerCase());

    componentsByLibrary[lib].push({
      page_id: page.id,
      name: page.title,
      library: lib,
      url: page.url,
      description: page.description,
      has_design_guide,
    });
  }

  // Sort by name within each library
  for (const lib of Object.keys(componentsByLibrary)) {
    componentsByLibrary[lib].sort((a, b) => a.name.localeCompare(b.name));
  }

  const total = componentPages.length;

  return { components_by_library: componentsByLibrary, total };
}
