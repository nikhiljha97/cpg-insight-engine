/**
 * Demand curve uplift % by temperature band (>20°C → <0°C).
 * Shared by Dashboard (chart) and Basket Analysis / API validation.
 */
export const CATEGORY_DEMAND = {
  "Canned Soup": [-15, 0, 18, 34, 51, 67],
  "Hot Beverages": [-20, -5, 15, 30, 48, 60],
  "Pasta & Sauce": [-10, 2, 14, 28, 40, 52],
  "Frozen Pizza": [-8, 4, 16, 26, 35, 44],
  "Bag Snacks": [10, 12, 8, 4, -2, -6],
  "Cold Cereal": [-5, 2, 8, 14, 20, 22],
  "Soft Drinks": [25, 18, 5, -5, -12, -15],
  "Ice Cream": [45, 30, 5, -10, -20, -25],
  "BBQ Meats": [38, 22, 4, -8, -18, -22],
} as const;

export type DemandCategory = keyof typeof CATEGORY_DEMAND;

export const DEMAND_CATEGORY_LIST: DemandCategory[] = Object.keys(CATEGORY_DEMAND) as DemandCategory[];

export function isDemandCategory(s: string): s is DemandCategory {
  return Object.prototype.hasOwnProperty.call(CATEGORY_DEMAND, s);
}
