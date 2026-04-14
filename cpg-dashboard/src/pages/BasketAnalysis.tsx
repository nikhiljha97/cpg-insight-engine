const companions = [
  ["Fluid Milk", 48.0],
  ["Bananas", 29.0],
  ["White Bread", 25.6],
  ["Shredded Cheese", 23.2],
  ["Soft Drinks", 19.5],
  ["Orange Juice", 15.6],
  ["Kids Cereal", 14.9],
  ["Potato Chips", 14.4],
  ["Eggs", 13.4],
  ["Wheat Bread", 13.2]
] as const;

const pairs = [
  ["Hot Dog Buns + Premium Beef", "14.6x", "0.217%"],
  ["Hot Dog Buns + Premium Meat", "13.3x", "0.579%"],
  ["Frozen Patties + Hamburger Buns", "10.8x", "0.343%"],
  ["Refrigerated Biscuits + Pork Rolls", "10.2x", "0.312%"],
  ["Economy Meat + Hot Dog Buns", "10.1x", "0.404%"],
  ["Hamburger Buns + Patties", "8.6x", "0.258%"],
  ["Cream Cheese + Misc Meat", "8.1x", "0.244%"],
  ["Lean Meat + Mexican Seasoning", "8.1x", "0.310%"]
] as const;

export default function BasketAnalysis() {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Basket Analysis</p>
          <h2>Soup Companion Patterns</h2>
        </div>
      </header>

      <div className="kpi-grid">
        <div className="card kpi-card">
          <span>Total Baskets</span>
          <strong>275K</strong>
        </div>
        <div className="card kpi-card">
          <span>Households</span>
          <strong>2500</strong>
        </div>
        <div className="card kpi-card">
          <span>Data Period</span>
          <strong>2 years</strong>
        </div>
        <div className="card kpi-card">
          <span>Soup Basket Rate</span>
          <strong>48%</strong>
        </div>
      </div>

      <div className="two-column">
        <div className="card">
          <div className="section-title-row">
            <h3>SOUP Companions</h3>
            <span className="mono">% of soup baskets</span>
          </div>
          <div className="bar-list">
            {companions.map(([label, value]) => (
              <div key={label} className="bar-row">
                <div className="bar-meta">
                  <span>{label}</span>
                  <strong>{value}%</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-title-row">
            <h3>Top Cross-Department Pairs</h3>
            <span className="mono">Lift-driven opportunities</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Pair</th>
                <th>Lift</th>
                <th>Support</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map(([pair, lift, support]) => (
                <tr key={pair}>
                  <td>{pair}</td>
                  <td>{lift}</td>
                  <td>{support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card callout">
        <h3>Insight Callout</h3>
        <p>
          Soup is the clearest cold-weather anchor in this dataset, with fluid milk appearing in nearly half of
          all soup baskets. The dashboard should use this as a featured bundle story while cross-department lift
          pairs provide secondary promotional themes for grilling, comfort food, and seasonal end-cap planning.
        </p>
      </div>
    </section>
  );
}
