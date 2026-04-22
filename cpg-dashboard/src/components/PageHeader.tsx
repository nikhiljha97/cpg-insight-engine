import { useMemo } from "react";
import { useUiDensity } from "./UiDensity";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
};

export default function PageHeader({ eyebrow, title, description, right }: Props) {
  const { density } = useUiDensity();
  const desc = useMemo(() => {
    if (!description) return null;
    if (density === "analyst") return description;
    // executive mode: keep it tight
    return description.length > 92 ? `${description.slice(0, 92).trim()}…` : description;
  }, [density, description]);

  return (
    <header className="page-head">
      <div className="page-head__left">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="page-head__title">{title}</h2>
        {desc && <p className="page-head__desc">{desc}</p>}
      </div>
      <div className="page-head__right">{right}</div>
    </header>
  );
}

