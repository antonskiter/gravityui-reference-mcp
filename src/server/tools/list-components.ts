import type { LoadedData } from "../loader.js";

export interface ListComponentsInput {
  library?: string;
}

export interface ComponentEntry {
  name: string;
  page_id: string;
  description: string;
  has_design_guide: boolean;
}

export interface LibraryGroup {
  id: string;
  title: string;
  components: ComponentEntry[];
}

export interface ListComponentsOutput {
  libraries: LibraryGroup[];
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

  // Group by library
  const groupMap = new Map<string, ComponentEntry[]>();

  for (const page of componentPages) {
    const lib = page.library ?? "unknown";
    if (!groupMap.has(lib)) {
      groupMap.set(lib, []);
    }

    const has_design_guide = guideNames.has(page.title.toLowerCase());

    groupMap.get(lib)!.push({
      name: page.title,
      page_id: page.id,
      description: page.description,
      has_design_guide,
    });
  }

  // Sort components by name within each library, build output
  const libraries: LibraryGroup[] = [];
  for (const [lib, components] of groupMap) {
    components.sort((a, b) => a.name.localeCompare(b.name));
    libraries.push({
      id: lib,
      title: lib,
      components,
    });
  }

  // Sort libraries by id
  libraries.sort((a, b) => a.id.localeCompare(b.id));

  return { libraries };
}

export function formatListComponents(result: ListComponentsOutput): string {
  const lines: string[] = [];
  for (const lib of result.libraries) {
    lines.push(`${lib.title} (${lib.components.length} components)`);
    for (const c of lib.components) {
      lines.push(`- ${c.name} (${c.page_id})`);
    }
  }
  return lines.join("\n");
}
