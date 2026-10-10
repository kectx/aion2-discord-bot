import { describe, expect, it } from "vitest";
import { shouldShowRegionOnAlert } from "../src/services/alert-scheduler.js";

describe("shouldShowRegionOnAlert", () => {
  it("hides region when it matches guild default and all alerts share it", () => {
    expect(shouldShowRegionOnAlert("eu", "eu", ["eu", "eu"])).toBe(false);
  });

  it("shows region when alert differs from guild default", () => {
    expect(shouldShowRegionOnAlert("asia", "eu", ["asia"])).toBe(true);
  });

  it("shows region when guild has alerts for multiple regions", () => {
    expect(shouldShowRegionOnAlert("eu", "eu", ["eu", "asia"])).toBe(true);
  });

  it("hides region when no default but only one alert region", () => {
    expect(shouldShowRegionOnAlert("eu", null, ["eu"])).toBe(false);
  });
});
