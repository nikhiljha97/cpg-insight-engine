import type { Page } from "@playwright/test";
import { isDemandCategory, type DemandCategory } from "../src/constants/demandCategories";
import { DEMAND_CATEGORY_STATCAN_VECTOR, VECTOR_SERIES_LABEL } from "../server/demandCategoryStatcan";

/** Deterministic weather so Dashboard leaves loading without calling Open-Meteo from the browser path. */
function mockWeatherPayload() {
  const city = { name: "Mississauga", lat: 43.589, lon: -79.6441 };
  const mk = (
    date: string,
    tempAvg: number,
    precip: number,
    code: number
  ): Record<string, string | number | boolean> => ({
    date,
    tempMax: tempAvg + 2,
    tempMin: tempAvg - 2,
    tempAvg,
    precipitationMm: precip,
    weatherCode: code,
    weatherLabel: "Overcast",
    inTriggerWindow: false,
    emoji: "☁️",
  });
  /* Days at indices 1–3 are the activation slice; include real precip + rain code so cold lane can go ON when cold slider is above the ~13°C 3-day avg. */
  const forecast = [
    mk("2030-06-01", 16, 0, 3),
    mk("2030-06-02", 14, 2.5, 63),
    mk("2030-06-03", 13, 0.2, 3),
    mk("2030-06-04", 12, 0, 3),
    mk("2030-06-05", 15, 0, 3),
    mk("2030-06-06", 17, 0, 3),
    mk("2030-06-07", 18, 0, 3),
  ];
  const trigger = {
    triggered: true,
    coldTriggered: true,
    hotTriggered: false,
    avgTemp: 13,
    wetDays: 2,
    threshold: 12,
    hotThreshold: 26,
    windowDates: ["2030-06-02", "2030-06-03", "2030-06-04"],
  };
  return { city, forecast, trigger };
}

/**
 * Stub slow or flaky upstreams for the SPA. Basket / signals still hit the local API + repo JSON.
 */
export async function installUpstreamMocks(page: Page): Promise<void> {
  await page.route("**/api/signals/macro-strip*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        grocery: {
          mergedAt: "2030-01-01T00:00:00Z",
          latestMonth: "2030-05",
          meanListPrice: 6.42,
          medianListPrice: 4.99,
          prevMonth: "2030-04",
          prevMean: 6.55,
          momPctMean: -2.0,
          series: [
            { month: "2030-01", mean: 6.9 },
            { month: "2030-02", mean: 6.8 },
            { month: "2030-03", mean: 6.7 },
            { month: "2030-04", mean: 6.55 },
            { month: "2030-05", mean: 6.42 },
          ],
        },
        cpi: { value: 168.1, latest_period: "25-Jun", city: "Toronto" },
      }),
    });
  });

  await page.route("**/api/weather*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockWeatherPayload()),
    });
  });

  await page.route("**/api/statcan/ontario-retail*", async (route) => {
    let category: DemandCategory = "Canned Soup";
    try {
      const u = new URL(route.request().url());
      const raw = u.searchParams.get("demandCategory");
      if (raw && isDemandCategory(raw)) category = raw;
    } catch {
      /* keep default */
    }
    const vectorId = DEMAND_CATEGORY_STATCAN_VECTOR[category];
    const baseTitle = VECTOR_SERIES_LABEL[vectorId] ?? `Vector ${vectorId}`;
    const bump = (vectorId % 97) / 10;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { period: "2024-07", value: Math.round((2638 + bump) * 10) / 10, unit: "$M" },
          { period: "2024-08", value: Math.round((2613 + bump) * 10) / 10, unit: "$M" },
          { period: "2024-09", value: Math.round((2573 + bump) * 10) / 10, unit: "$M" },
          { period: "2024-10", value: Math.round((2551 + bump) * 10) / 10, unit: "$M" },
          { period: "2024-11", value: Math.round((2529 + bump) * 10) / 10, unit: "$M" },
          { period: "2024-12", value: Math.round((2685 + bump) * 10) / 10, unit: "$M" },
          { period: "2025-01", value: Math.round((2498 + bump) * 10) / 10, unit: "$M" },
          { period: "2025-02", value: Math.round((2520 + bump) * 10) / 10, unit: "$M" },
        ],
        trend: "up",
        latestValue: Math.round((2520 + bump) * 10) / 10,
        prevValue: Math.round((2498 + bump) * 10) / 10,
        changePercent: 0.9,
        meta: {
          seriesKind: "ontario_naics_unadjusted",
          table: "UAT — Statistics Canada Table 20-10-0056-02 (stub)",
          vectorId,
          statcanSeriesTitle: `${baseTitle} (stub)`,
          notes: "Playwright mock, not live StatCan.",
        },
      }),
    });
  });

  await page.route("**/api/traffic/gta", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        incidentCount: 2,
        disruptionLevel: "Low",
        topEvents: [{ description: "UAT mock incident", county: "Peel", road: "401" }],
      }),
    });
  });

  await page.route("**/api/forecast/demand**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        city: "Mississauga",
        category: "Canned Soup",
        weeks: [
          {
            weekStart: "2030-07-07",
            index: 102.5,
            indexLow: 97,
            indexHigh: 108,
            drivers: ["UAT seasonality factor 1.020", "UAT holiday uplift +0.0%"],
          },
          {
            weekStart: "2030-07-14",
            index: 101.2,
            indexLow: 96,
            indexHigh: 106,
            drivers: ["UAT driver B"],
          },
        ],
        baselineWeeklyMillions: 2288,
        methodology: "UAT demand forecast stub — not live StatCan math.",
        weatherWindowDates: ["2030-06-02", "2030-06-03", "2030-06-04"],
        coldTriggered: false,
        hotTriggered: false,
      }),
    });
  });

  /* Signal pages read unified JSON on the server; CI often has no file — empty {} crashes React. Stub minimal shapes. */
  await page.route("**/api/signals/promo**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        best_tactic_by_category: [
          {
            category: "Canned Soup",
            store_tier: "MAINSTREAM",
            best_tactic: "Feature + Display",
            lift: 1.12,
            baseline_units: 4200,
          },
        ],
        best_store_tier_for_activation: "MAINSTREAM",
        store_tier_lift_scores: { MAINSTREAM: 0.14, VALUE: 0.09, UPSCALE: 0.06 },
        carbo_top_promo: [
          {
            commodity: "Pasta",
            feature_type: "Feature",
            display_type: "End cap",
            baskets: 120,
            total_units: 480,
            total_sales: 960,
          },
        ],
      }),
    });
  });

  await page.route("**/api/signals/price-elasticity**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        most_elastic_categories: [
          {
            category: "Ice Cream",
            store_tier: "VALUE",
            elasticity_coef: -1.15,
            interpretation: "Highly elastic in UAT.",
            avg_price: 4.2,
            avg_units: 900,
          },
        ],
        discount_depth_impact: [
          {
            category: "Canned Soup",
            discount_tier: "0-5% off",
            avg_units: 12,
            avg_visits: 2.1,
            avg_households: 1.4,
            observations: 50,
          },
        ],
        store_tier_summary: [
          {
            store_tier: "MAINSTREAM",
            store_count: 24,
            avg_sqft: 42000,
            avg_weekly_baskets: 5100,
            avg_shelf_price: 3.1,
            avg_discount_amount: 0.22,
            avg_units_per_sku_week: 11,
          },
        ],
      }),
    });
  });

  await page.route("**/api/signals/demographics**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        top_soup_buyer_segment: {
          age_group: "Age Group4",
          income_group: "Level5",
          has_kids: "Y",
          homeowner: "Y",
          marital_status: "M",
          soup_buyers: 120,
          total_buyers: 600,
          soup_penetration_pct: 20,
        },
        all_segments: [
          {
            age_group: "Age Group4",
            income_group: "Level5",
            has_kids: "Y",
            homeowner: "Y",
            marital_status: "M",
            soup_buyers: 120,
            total_buyers: 600,
            soup_penetration_pct: 20,
          },
        ],
        coupon_usage_by_dept: [
          { DEPARTMENT: "Grocery", total_hh: 1000, coupon_users: 100, coupon_pct: 10 },
        ],
        spend_trajectory: [
          { period: "early", weeks: "1-34", segment: "Soup Buyer", avg_spend: 52 },
          { period: "early", weeks: "1-34", segment: "Non-Soup Buyer", avg_spend: 41 },
          { period: "mid", weeks: "35-68", segment: "Soup Buyer", avg_spend: 55 },
          { period: "mid", weeks: "35-68", segment: "Non-Soup Buyer", avg_spend: 43 },
          { period: "late", weeks: "69-102", segment: "Soup Buyer", avg_spend: 53 },
          { period: "late", weeks: "69-102", segment: "Non-Soup Buyer", avg_spend: 42 },
        ],
      }),
    });
  });

  await page.route("**/api/sentiment/reddit-grocery**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fetchedAt: "2030-01-01T00:00:00Z",
        aggregateScore: 0.06,
        matchedCount: 1,
        usedFallback: false,
        oauthUsed: false,
        posts: [
          {
            subreddit: "canada",
            title: "UAT grocery prices thread for sentiment tab",
            link: "https://www.reddit.com/r/canada/comments/uat123/",
            sentiment: 0.06,
            groceryMatch: true,
          },
        ],
        subreddits: ["canada", "AskCanada"],
        methodology: "UAT Reddit sentiment stub.",
      }),
    });
  });

  await page.route("**/api/nlq/chat", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "UAT copilot: **sample** answer (Groq mocked in Playwright).",
        chart: null,
      }),
    });
  });

  await page.route("**/api/basket-insights**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    let category = "Canned Soup";
    try {
      const u = new URL(route.request().url());
      const c = u.searchParams.get("category");
      if (c) category = decodeURIComponent(c);
    } catch {
      /* keep default */
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        city: "Mississauga",
        season: "spring",
        scenario: "cold_dry",
        scenarioLabel: "Cold & dry — pantry & value stocking",
        anchor: {
          key: "soup",
          label: `${category} basket lens`,
          rationale: `UAT stub for ${category}.`
        },
        demandCategory: category,
        thresholdUsed: 12,
        hotThresholdUsed: 26,
        trigger: {
          triggered: false,
          coldTriggered: false,
          hotTriggered: false,
          avgTemp: 13,
          wetDays: 0,
          threshold: 12,
          hotThreshold: 26,
          windowDates: ["2030-06-02", "2030-06-03", "2030-06-04"]
        },
        forecast: [],
        companions: [
          { product: "UAT Companion A", pct: 40 },
          { product: "UAT Companion B", pct: 28 }
        ],
        pairs: [{ pair: "UAT Pair One + Two", lift: "9.9x", support: "—" }],
        kpis: {
          totalBaskets: "275K+",
          households: "2,500",
          dataPeriod: "2 years",
          anchorBasketRate: "~42%",
          anchorRateLabel: `${category} basket rate (est.)`
        },
        callout: "UAT automated basket callout — upstream APIs mocked.",
        meta: { last_updated: "2030-01-01T00:00:00Z" }
      })
    });
  });
}
