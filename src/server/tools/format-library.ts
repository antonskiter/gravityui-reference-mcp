import type { LibraryOverviewEntry, DesignSystemOverview } from '../../types.js';

export function formatLibrary(lib: LibraryOverviewEntry): string {
  const lines: string[] = [];
  const pkg = lib.package.startsWith('@') ? lib.package : `@${lib.package}`;
  lines.push(`${lib.id} (${pkg})`);
  lines.push(lib.purpose);
  lines.push(`${lib.component_count} components`);
  lines.push(`Depends on: ${lib.depends_on && lib.depends_on.length > 0 ? lib.depends_on.join(', ') : 'none'}`);
  lines.push(`Used by: ${lib.is_peer_dependency_of && lib.is_peer_dependency_of.length > 0 ? lib.is_peer_dependency_of.join(', ') : 'none'}`);
  return lines.join('\n');
}

export function formatOverview(overview: DesignSystemOverview): string {
  const lines: string[] = [];
  lines.push('Gravity UI Design System');
  lines.push(`Theming: ${overview.system.theming}`);
  lines.push(`Spacing: ${overview.system.spacing}`);
  lines.push(`Typography: ${overview.system.typography}`);
  const libIds = overview.libraries.map(l => l.id).join(', ');
  lines.push(`${overview.libraries.length} libraries: ${libIds}`);
  return lines.join('\n');
}
