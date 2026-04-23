import { Link, Redirect, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import Dashboard from "./pages/Dashboard";
import BasketAnalysis from "./pages/BasketAnalysis";
import PitchHistory from "./pages/PitchHistory";
import PromoAttribution from "./pages/PromoAttribution";
import PriceElasticity from "./pages/PriceElasticity";
import DemographicSegments from "./pages/DemographicSegments";
import DemandForecast from "./pages/DemandForecast";
import BrandSentiment from "./pages/BrandSentiment";
import EsgInsights from "./pages/EsgInsights";
import SentimentMacro from "./pages/SentimentMacro";
import RetailPulse from "./pages/RetailPulse";
import About from "./pages/About";
import { WeatherProvider } from "./pages/WeatherContext";
import InsightsAssistantDrawer from "./components/InsightsAssistantDrawer";
import SignalsAddonBanner from "./components/SignalsAddonBanner";
import { UiDensityProvider, useUiDensity } from "./components/UiDensity";
import { SignalsAddonProvider } from "./context/SignalsAddonContext";

/** Enables Brand Sentiment + standalone Reddit pulse (gated together). */
const ENABLE_BRAND_SENTIMENT_PAGE = true;

const BRAND_SENTIMENT_GATED_HREFS = new Set(["/sentiment", "/reddit-pulse"]);

const allNavItems = [
  { href: "/", label: "About" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/basket", label: "Basket Analysis" },
  { href: "/history", label: "Pitch History" },
  { href: "/promo", label: "Promo Attribution" },
  { href: "/elasticity", label: "Price Elasticity" },
  { href: "/demographics", label: "Demographics" },
  { href: "/forecast", label: "Demand Forecast" },
  { href: "/signals", label: "Sentiment & macro" },
  { href: "/reddit-pulse", label: "Reddit pulse" },
  { href: "/sentiment", label: "Brand Sentiment" },
  { href: "/esg", label: "ESG Insights" },
];

const navItems = ENABLE_BRAND_SENTIMENT_PAGE
  ? allNavItems
  : allNavItems.filter((item) => !BRAND_SENTIMENT_GATED_HREFS.has(item.href));

function SentimentRoute() {
  return ENABLE_BRAND_SENTIMENT_PAGE ? <BrandSentiment /> : <Redirect to="/dashboard" />;
}

function RedditPulseRoute() {
  return ENABLE_BRAND_SENTIMENT_PAGE ? <RetailPulse /> : <Redirect to="/dashboard" />;
}

function DensityToggle() {
  const { density, toggleDensity } = useUiDensity();
  return (
    <button type="button" className="density-toggle" onClick={toggleDensity}>
      <span className="density-toggle__label">View</span>
      <span className="density-toggle__value">{density === "executive" ? "Executive" : "Analyst"}</span>
    </button>
  );
}

export default function App() {
  const [location] = useHashLocation();

  return (
    <UiDensityProvider>
      <WeatherProvider>
        <Router hook={useHashLocation}>
          <div className="app-shell">
            <aside className="sidebar">
              <div>
                <p className="eyebrow">CPG Retail Analytics</p>
                <h1>Insight Engine</h1>
                <p className="sidebar-copy">
                  Weather-aware retail insights with cold-wet and hot-dry lanes, basket analysis, CPG pitch generation,
                  demand forecasting, Reddit grocery sentiment (prototype), and ESG resources for Canadian markets.
                </p>
              </div>

              <DensityToggle />

              <nav className="nav-list" aria-label="Primary">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={location === item.href ? "nav-link active" : "nav-link"}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </aside>

            <main className="content">
              <SignalsAddonProvider>
                <SignalsAddonBanner />
                <Route path="/" component={About} />
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/basket" component={BasketAnalysis} />
                <Route path="/history" component={PitchHistory} />
                <Route path="/promo" component={PromoAttribution} />
                <Route path="/elasticity" component={PriceElasticity} />
                <Route path="/demographics" component={DemographicSegments} />
                <Route path="/forecast" component={DemandForecast} />
                <Route path="/signals" component={SentimentMacro} />
                <Route path="/reddit-pulse" component={RedditPulseRoute} />
                <Route path="/sentiment" component={SentimentRoute} />
                <Route path="/esg" component={EsgInsights} />
              </SignalsAddonProvider>
            </main>
            <InsightsAssistantDrawer />
          </div>
        </Router>
      </WeatherProvider>
    </UiDensityProvider>
  );
}
