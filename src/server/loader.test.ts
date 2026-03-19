import { describe, it, expect } from "vitest";
import { loadData } from "./loader.js";

describe("loadData", () => {
  it("loads without throwing", () => {
    const data = loadData();
    expect(data).toBeDefined();
  });

  it("has entities array", () => {
    const data = loadData();
    expect(Array.isArray(data.entities)).toBe(true);
  });

  it("builds lookup maps", () => {
    const data = loadData();
    expect(data.entityByName).toBeInstanceOf(Map);
    expect(data.entitiesByLibrary).toBeInstanceOf(Map);
    expect(data.entitiesByType).toBeInstanceOf(Map);
  });

  it("has search index", () => {
    const data = loadData();
    expect(data.index).toBeDefined();
  });

  it("loads entities from entity files", () => {
    const data = loadData();
    expect(data.entities.length).toBeGreaterThan(0);
    expect(data.entitiesByLibrary.size).toBeGreaterThan(0);
  });

  it("entityByName uses lowercase keys", () => {
    const data = loadData();
    for (const key of data.entityByName.keys()) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});
