import { useEffect, useMemo, useState } from "react";

type Props = {
  title: string;
  subtitle?: string;
  storageKey?: string;
  defaultCollapsed?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
};

function readStoredCollapsed(key?: string, fallback?: boolean) {
  if (!key || typeof window === "undefined") return !!fallback;
  try {
    const v = window.sessionStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* ignore */
  }
  return !!fallback;
}

export default function SectionCard({
  title,
  subtitle,
  storageKey,
  defaultCollapsed = false,
  right,
  children,
}: Props) {
  const initial = useMemo(
    () => readStoredCollapsed(storageKey, defaultCollapsed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [collapsed, setCollapsed] = useState<boolean>(initial);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.sessionStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, storageKey]);

  return (
    <section className="card section-card">
      <header className="section-card__head">
        <button
          type="button"
          className="section-card__toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
        >
          <span className="section-card__title">{title}</span>
          {subtitle && <span className="section-card__subtitle">{subtitle}</span>}
        </button>
        <div className="section-card__right">
          {right}
          <span className="section-card__chev" aria-hidden>
            {collapsed ? "▸" : "▾"}
          </span>
        </div>
      </header>
      {!collapsed && <div className="section-card__body">{children}</div>}
    </section>
  );
}

