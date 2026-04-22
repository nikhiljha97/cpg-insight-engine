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
import About from "./pages/About";
import { WeatherProvider } from "./pages/WeatherContext";
import InsightsAssistantDrawer from "./components/InsightsAssistantDrawer";

/** Flip to `true` to restore the Brand Sentiment nav link and page (`BrandSentiment.tsx` is unchanged). */
const ENABLE_BRAND_SENTIMENT_PAGE = false;

const allNavItems = [
  { href: "/", label: "About" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/basket", label: "Basket Analysis" },
  { href: "/history", label: "Pitch History" },
  { href: "/promo", label: "Promo Attribution" },
  { href: "/elasticity", label: "Price Elasticity" },
  { href: "/demographics", label: "Demographics" },
  { href: "/forecast", label: "Demand Forecast" },
  { href: "/sentiment", label: "Brand Sentiment" },
  { href: "/esg", label: "ESG Insights" },
];

const navItems = ENABLE_BRAND_SENTIMENT_PAGE
  ? allNavItems
  : allNavItems.filter((item) => item.href !== "/sentiment");

function SentimentRoute() {
  return ENABLE_BRAND_SENTIMENT_PAGE ? <BrandSentiment /> : <Redirect to="/dashboard" />;
}

export default function App() {
  const [location] = useHashLocation();

  return (
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
            <Route path="/" component={About} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/basket" component={BasketAnalysis} />
            <Route path="/history" component={PitchHistory} />
            <Route path="/promo" component={PromoAttribution} />
            <Route path="/elasticity" component={PriceElasticity} />
            <Route path="/demographics" component={DemographicSegments} />
            <Route path="/forecast" component={DemandForecast} />
            <Route path="/sentiment" component={SentimentRoute} />
            <Route path="/esg" component={EsgInsights} />
          </main>
          <InsightsAssistantDrawer />
        </div>
      </Router>
    </WeatherProvider>
  );
}
