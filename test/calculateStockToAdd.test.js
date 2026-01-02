import { describe, expect, it } from "vitest";

import { calculateStockToAdd } from "../calculateStockToAdd.js";

describe("calculateStockToAdd", () => {
  describe("Valid cases", () => {
    it("should return 0 when stock >= 3x daily consumption", () => {
      const result = calculateStockToAdd({
        type: "food",
        stocks: 7329,
        dailyConsumption: 2045,
      });
      expect(result).toBe(0);
    });

    it("should return amount needed to reach 4x when stock < 3x", () => {
      const result = calculateStockToAdd({
        type: "gifts",
        stocks: 500,
        dailyConsumption: 175,
      });
      expect(result).toBe(175 * 4 - 500); // 200
    });

    it("should return 4x daily consumption when stock is 0", () => {
      const result = calculateStockToAdd({
        type: "fries",
        stocks: 0,
        dailyConsumption: 350,
      });
      expect(result).toBe(350 * 4); // 1400
    });

    it("should return 0 when daily consumption is 0", () => {
      const result = calculateStockToAdd({
        type: "drinks",
        stocks: 3019,
        dailyConsumption: 0,
      });
      expect(result).toBe(0);
    });

    it("should return 0 when both stock and daily consumption are 0", () => {
      const result = calculateStockToAdd({
        type: "iceCreams",
        stocks: 0,
        dailyConsumption: 0,
      });
      expect(result).toBe(0);
    });

    it("should return 0 when stock is exactly 3x daily consumption", () => {
      const result = calculateStockToAdd({
        type: "food",
        stocks: 525,
        dailyConsumption: 175,
      });
      expect(result).toBe(0);
    });

    it("should return amount when stock is just under 3x daily consumption", () => {
      const result = calculateStockToAdd({
        type: "gifts",
        stocks: 524,
        dailyConsumption: 175,
      });
      expect(result).toBe(175 * 4 - 524); // 176
    });
  });

  describe("Error cases", () => {
    it("should throw error when stocks is negative", () => {
      expect(() =>
        calculateStockToAdd({
          type: "food",
          stocks: -100,
          dailyConsumption: 175,
        })
      ).toThrow("stocks and dailyConsumption cannot be negative");
    });

    it("should throw error when dailyConsumption is negative", () => {
      expect(() =>
        calculateStockToAdd({
          type: "gifts",
          stocks: 500,
          dailyConsumption: -175,
        })
      ).toThrow("stocks and dailyConsumption cannot be negative");
    });

    it("should throw error when both are negative", () => {
      expect(() =>
        calculateStockToAdd({
          type: "drinks",
          stocks: -50,
          dailyConsumption: -100,
        })
      ).toThrow("stocks and dailyConsumption cannot be negative");
    });
  });
});