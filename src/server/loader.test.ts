import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadJsonArray, loadJsonFile } from './loader.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `loader-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadJsonArray', () => {
  it('loads from per-library directory, concatenates and sorts by name', () => {
    const dir = join(tmpDir, 'components');
    mkdirSync(dir);
    writeFileSync(join(dir, 'uikit.json'), JSON.stringify([
      { name: 'TextInput', library: 'uikit' },
      { name: 'Button', library: 'uikit' },
    ]));
    writeFileSync(join(dir, 'aikit.json'), JSON.stringify([
      { name: 'Alert', library: 'aikit' },
    ]));

    const result = loadJsonArray<{ name: string; library: string }>(tmpDir, 'components');
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Alert');
    expect(result[1].name).toBe('Button');
    expect(result[2].name).toBe('TextInput');
  });

  it('falls back to single file when directory does not exist', () => {
    writeFileSync(join(tmpDir, 'components.json'), JSON.stringify([
      { name: 'Select', library: 'uikit' },
      { name: 'Card', library: 'uikit' },
    ]));

    const result = loadJsonArray<{ name: string; library: string }>(tmpDir, 'components');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Card');
    expect(result[1].name).toBe('Select');
  });

  it('returns empty array when neither directory nor file exists', () => {
    const result = loadJsonArray<{ name: string }>(tmpDir, 'components');
    expect(result).toEqual([]);
  });

  it('sorts items by id when name is not present', () => {
    const dir = join(tmpDir, 'chunks');
    mkdirSync(dir);
    writeFileSync(join(dir, 'uikit.json'), JSON.stringify([
      { id: 'z-chunk', content: 'Z' },
      { id: 'a-chunk', content: 'A' },
    ]));

    const result = loadJsonArray<{ id: string; content: string }>(tmpDir, 'chunks');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a-chunk');
    expect(result[1].id).toBe('z-chunk');
  });

  it('ignores non-json files in directory', () => {
    const dir = join(tmpDir, 'components');
    mkdirSync(dir);
    writeFileSync(join(dir, 'uikit.json'), JSON.stringify([{ name: 'Button', library: 'uikit' }]));
    writeFileSync(join(dir, 'README.md'), '# Docs');
    writeFileSync(join(dir, '.gitkeep'), '');

    const result = loadJsonArray<{ name: string; library: string }>(tmpDir, 'components');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Button');
  });
});

describe('loadJsonFile', () => {
  it('loads and parses a JSON file', () => {
    const filePath = join(tmpDir, 'data.json');
    writeFileSync(filePath, JSON.stringify({ key: 'value', count: 42 }));

    const result = loadJsonFile<{ key: string; count: number }>(filePath, { key: '', count: 0 });
    expect(result.key).toBe('value');
    expect(result.count).toBe(42);
  });

  it('returns fallback when file does not exist', () => {
    const filePath = join(tmpDir, 'nonexistent.json');
    const fallback = { default: true };

    const result = loadJsonFile(filePath, fallback);
    expect(result).toEqual(fallback);
  });

  it('returns fallback when file contains invalid JSON', () => {
    const filePath = join(tmpDir, 'bad.json');
    writeFileSync(filePath, 'not valid json {{');

    const fallback = { error: true };
    const result = loadJsonFile(filePath, fallback);
    expect(result).toEqual(fallback);
  });
});
