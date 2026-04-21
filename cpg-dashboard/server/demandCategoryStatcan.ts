import type { DemandCategory } from "../src/constants/demandCategories.js";

/**
 * Ontario NAICS rows from StatCan table 20-10-0056-02 (cube 20100056), monthly,
 * **not seasonally adjusted** — WDS vectors (StatCan does not publish SA for these
 * industry rows at the Ontario level in this product).
 *
 * Demand categories map to the closest published NAICS slice (still broader than SKU).
 */
export const DEMAND_CATEGORY_STATCAN_VECTOR: Record<DemandCategory, number> = {
  "Canned Soup": 1446859799,
  "Hot Beverages": 1446859799,
  "Pasta & Sauce": 1446859799,
  "Frozen Pizza": 1446859799,
  "Bag Snacks": 1446859799,
  "Cold Cereal": 1446859799,
  "BBQ Meats": 1446859799,
  /** Convenience + full food channel — softer drinks / frozen treats often move outside pure supermarket reporting. */
  "Soft Drinks": 1446859797,
  "Ice Cream": 1446859797,
};

export const VECTOR_SERIES_LABEL: Record<number, string> = {
  1446859797: "Ontario — Food and beverage retailers [445] (NAICS), unadjusted",
  1446859799:
    "Ontario — Supermarkets & other grocery (excl. convenience) [44511] (NAICS), unadjusted",
};

/** If WDS fails: scale Ontario **total retail SA** (0056-01) by this share for continuity. */
export const CATEGORY_ONTARIO_RETAIL_FALLBACK_SHARE: Record<DemandCategory, number> = {
  "Canned Soup": 0.012,
  "Hot Beverages": 0.018,
  "Pasta & Sauce": 0.022,
  "Frozen Pizza": 0.016,
  "Bag Snacks": 0.02,
  "Cold Cereal": 0.015,
  "Soft Drinks": 0.025,
  "Ice Cream": 0.011,
  "BBQ Meats": 0.019,
};
