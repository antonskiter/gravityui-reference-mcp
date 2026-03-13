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
