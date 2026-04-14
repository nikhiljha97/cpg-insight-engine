import { Link, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import Dashboard from "./pages/Dashboard";
import BasketAnalysis from "./pages/BasketAnalysis";
import PitchHistory from "./pages/PitchHistory";
import PromoAttribution from "./pages/PromoAttribution";
import PriceElasticity from "./pages/PriceElasticity";
import DemographicSegments from "./pages/DemographicSegments";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/basket", label: "Basket Analysis" },
  { href: "/history", label: "Pitch History" },
  { href: "/promo", label: "Promo Attribution" },
  { href: "/elasticity", label: "Price Elasticity" },
  { href: "/demographics", label: "Demographics" }
];

export default function App() {
  const [location] = useHashLocation();

  return (
    <Router hook={useHashLocation}>
      <div className="app-shell">
        <aside className="sidebar">
          <div>
            <p className="eyebrow">CPG Retail Analytics</p>
            <h1>Insight Engine</h1>
            <p className="sidebar-copy">
              Weather-aware retail insights, basket analysis, and CPG pitch generation for Canadian markets.
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
          <Route path="/" component={Dashboard} />
          <Route path="/basket" component={BasketAnalysis} />
          <Route path="/history" component={PitchHistory} />
          <Route path="/promo" component={PromoAttribution} />
          <Route path="/elasticity" component={PriceElasticity} />
          <Route path="/demographics" component={DemographicSegments} />
        </main>
      </div>
    </Router>
  );
}
