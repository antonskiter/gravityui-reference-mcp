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

  it("has overview", () => {
    const data = loadData();
    expect(data.overview).toBeDefined();
    expect(data.overview.system).toBeDefined();
  });

  it("loads recipes", () => {
    const data = loadData();
    expect(Array.isArray(data.recipes)).toBe(true);
  });

  it("loads entities from entity files", () => {
    const data = loadData();
    // We have 33 extracted libraries so far
    expect(data.entities.length).toBeGreaterThan(0);
    expect(data.entitiesByLibrary.size).toBeGreaterThan(0);
  });
});
