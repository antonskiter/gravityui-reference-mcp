export const LIBRARY_PRIORITY: string[] = [
  'uikit', 'components', 'navigation',
  'date-components', 'page-constructor', 'table', 'blog-constructor',
];

export function pickByLibraryPriority<T extends { library: string }>(items: T[]): T | undefined {
  for (const lib of LIBRARY_PRIORITY) {
    const match = items.find(i => i.library === lib);
    if (match) return match;
  }
  return items[0];
}
