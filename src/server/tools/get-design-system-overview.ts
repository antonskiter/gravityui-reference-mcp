import type { LoadedData, DesignSystemOverview } from "../loader.js";

export interface GetDesignSystemOverviewInput {
  library?: string;
}

export interface GetDesignSystemOverviewError {
  error: string;
}

export function handleGetDesignSystemOverview(
  data: LoadedData,
  input: GetDesignSystemOverviewInput,
): DesignSystemOverview | GetDesignSystemOverviewError {
  const { library } = input;

  if (library) {
    const libEntry = data.overview.libraries.find(l => l.id === library);
    if (!libEntry) {
      return { error: `Library not found: ${library}` };
    }
    return {
      system: data.overview.system,
      libraries: [libEntry],
    };
  }

  return data.overview;
}

export function formatGetDesignSystemOverview(result: DesignSystemOverview | GetDesignSystemOverviewError): string {
  if ("error" in result) return `Error: ${result.error}`;

  const { system, libraries } = result;
  const lines: string[] = [
    "# Gravity UI Design System",
    system.description,
    "",
    "## Theming",
    system.theming,
    "",
    "## Spacing",
    system.spacing,
    "",
    "## Typography",
    system.typography,
    "",
    "## Corner Radius",
    system.corner_radius,
    "",
    "## Branding",
    system.branding,
    "",
    "## Libraries",
  ];

  for (const lib of libraries) {
    const depends = lib.depends_on.length > 0 ? `Depends on: ${lib.depends_on.join(", ")}` : "";
    const peer = lib.is_peer_dependency_of.length > 0 ? `Peer of: ${lib.is_peer_dependency_of.join(", ")}` : "";
    const meta = [depends, peer].filter(Boolean).join(" | ");
    lines.push(`- **${lib.id}** (${lib.package}) — ${lib.component_count} components — ${lib.purpose}`);
    if (meta) lines.push(`  ${meta}`);
  }

  return lines.join("\n");
}
