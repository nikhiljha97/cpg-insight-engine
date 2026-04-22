/**
 * Single source for cross-cutting defaults (client, server, Vite, Playwright, shell docs).
 * Prefer importing from here over duplicating literals in components or Express.
 */

import type { DemandCategory } from "./demandCategories";

export const DEFAULT_DEMAND_CATEGORY: DemandCategory = "Canned Soup";

export const DEFAULT_SELECTED_CITY = "Mississauga";

/** Cold comfort cut-off (°C) — aligned with `04_weather_trigger` / dashboard cold lane */
export const DEFAULT_COLD_THRESHOLD_C = 12;

/** Hot summer activation cut-off (°C) — default hot slider */
export const DEFAULT_HOT_THRESHOLD_C = 26;

export const HOT_THRESHOLD_MIN_C = 18;
export const HOT_THRESHOLD_MAX_C = 40;

/** Vite dev server port (`vite.config.ts` server.port) */
export const DEV_SERVER_PORT = 3000;

/** Express API default (`PORT` env overrides) */
export const API_DEFAULT_PORT = 4000;

/** `vite preview` port used by Playwright + `scripts/e2e.sh` */
export const E2E_PREVIEW_PORT = 4173;

/** Hosted static dashboard (Render) — CORS allowlist default */
export const PUBLIC_DASHBOARD_ORIGIN = "https://cpg-insight-engine.onrender.com";

/** Canonical repo URL (Reddit API User-Agent, docs, etc.) */
export const REPO_URL = "https://github.com/nikhiljha97/cpg-insight-engine";

/** Minimum length for `DATA_REFRESH_SECRET` on the API (cron + internal refresh). */
export const DATA_REFRESH_SECRET_MIN_LEN = 12;
