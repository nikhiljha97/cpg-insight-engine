import { useEffect, useState } from "react";

export default function PromoAttribution() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/signals/promo");
        const json = await res.json();
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load promo signals");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Signals</p>
          <h2>Promo Attribution</h2>
        </div>
      </header>

      {error ? <div className="callout error">{error}</div> : null}

      <div className="card">
        <div className="section-title-row">
          <h3>Unified bundle — promo_attribution</h3>
          <span className="mono">GET /api/signals/promo</span>
        </div>
        {loading ? <div className="skeleton pitch-skeleton" /> : <pre className="json-panel">{JSON.stringify(data, null, 2)}</pre>}
      </div>
    </section>
  );
}
