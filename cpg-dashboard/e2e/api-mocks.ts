import type { Page } from "@playwright/test";

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
  const forecast = [
    mk("2030-06-01", 16, 0, 3),
    mk("2030-06-02", 14, 0, 3),
    mk("2030-06-03", 13, 0, 3),
    mk("2030-06-04", 12, 0, 3),
    mk("2030-06-05", 15, 0, 3),
    mk("2030-06-06", 17, 0, 3),
    mk("2030-06-07", 18, 0, 3),
  ];
  const trigger = {
    triggered: false,
    avgTemp: 13,
    wetDays: 0,
    threshold: 12,
    windowDates: ["2030-06-02", "2030-06-03", "2030-06-04"],
  };
  return { city, forecast, trigger };
}

/**
 * Stub slow or flaky upstreams for the SPA. Basket / signals still hit the local API + repo JSON.
 */
export async function installUpstreamMocks(page: Page): Promise<void> {
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

  await page.route("**/api/statcan/ontario-retail", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          { period: "2025-01", value: 62.1, unit: "$M" },
          { period: "2025-02", value: 62.4, unit: "$M" },
        ],
        trend: "flat",
        latestValue: 62.4,
        prevValue: 62.1,
        changePercent: 0.5,
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
        trigger: {
          triggered: false,
          avgTemp: 13,
          wetDays: 0,
          threshold: 12,
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
