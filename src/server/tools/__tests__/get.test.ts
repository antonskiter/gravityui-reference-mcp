import { describe, it, expect } from 'vitest';
import { resolveGet } from '../get.js';

describe('get tool — ecosystem extension', () => {
  it('resolves exact library id to a library card', async () => {
    // i18n is in ALL_LIBRARIES — should surface the i18n library entry
    const result = await resolveGet('i18n');
    expect(result).toContain('i18n');
  });

  it('resolves exact npm package name to a library card', async () => {
    const result = await resolveGet('@gravity-ui/icons');
    expect(result).toContain('icons');
  });

  it('returns not-found for unknown topic', async () => {
    const result = await resolveGet('__nonexistent_entity_xyz__');
    expect(result).toContain('not found');
  });
});
