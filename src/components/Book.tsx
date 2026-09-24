import { Butterfly, Star } from "./ReverieScene";
import { Glyph } from "./SpecimenDeco";

/**
 * A hardcover notebook that hovers above its own shadow. Appearance comes
 * entirely from themes.css via data-cover, so it restyles with the theme.
 */
export function Book({
  title,
  cover = 0,
  volume,
  size = "md",
  delay = 0,
}: {
  title?: React.ReactNode;
  cover?: number;
  volume?: number;
  size?: "md" | "lg";
  delay?: number;
}) {
  return (
    <div className={`book book-${size}`} data-cover={cover} style={{ "--float-delay": `${delay}s` } as React.CSSProperties}>
      <div className="book-shadow" />
      <div className="book-body">
        <div className="book-spine" />
        <div className="book-face">
          {volume !== undefined && <span className="book-vol">vol. {String(volume).padStart(2, "0")}</span>}
          <Emblem cover={cover} />
          <CoverPlate />
          {title && <span className="book-title">{title}</span>}
          <span className="book-mark">✦</span>
        </div>
      </div>
    </div>
  );
}

/** Specimen only: each cover is a radiograph plate with a scan box. */
function CoverPlate() {
  return (
    <span className="deco-specimen cover-plate" aria-hidden="true">
      <span className="cover-art" />
      <span className="cover-top">
        <Glyph />
      </span>
      <span className="sp-box cover-box" />
    </span>
  );
}

/** Glowing cover art, shown only by Reverie. */
function Emblem({ cover }: { cover: number }) {
  const art = [
    <Butterfly key="b" className="emblem-svg" />,
    <span key="s" className="emblem-stars">
      <Star className="emblem-star emblem-star-1" />
      <Star className="emblem-star emblem-star-2" />
      <Star className="emblem-star emblem-star-3" />
    </span>,
    <svg key="m" className="emblem-svg" viewBox="0 0 60 60" aria-hidden="true">
      <path fill="currentColor" d="M38 6 A24 24 0 1 0 54 44 A20 20 0 1 1 38 6 Z" />
    </svg>,
    <svg key="f" className="emblem-svg" viewBox="0 0 60 60" aria-hidden="true">
      <g fill="currentColor" transform="translate(30 30)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} rx="7" ry="13" cy="-11" transform={`rotate(${r})`} opacity="0.9" />
        ))}
        <circle r="5" fill="#fff3d6" />
      </g>
    </svg>,
  ][cover % 4];
  return <span className="book-emblem">{art}</span>;
}
