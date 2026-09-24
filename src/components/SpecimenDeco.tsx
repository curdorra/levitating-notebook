/**
 * Ornaments for the Specimen theme: registration brackets and the
 * eight-petal glyph. Each is inside a `.deco-specimen` element, which only
 * Specimen displays.
 */

/** Eight-petal outline, the poster's masthead mark. */
export function Glyph({ className }: { className?: string }) {
  return (
    <svg className={`sp-glyph ${className ?? ""}`} viewBox="-12 -12 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.1">
        {[0, 45, 90, 135].map((r) => (
          <ellipse key={r} rx="3.6" ry="10" transform={`rotate(${r})`} />
        ))}
        <circle r="2" />
      </g>
    </svg>
  );
}

/** Corner registration marks; fills its positioned parent. */
export function Brackets({ className }: { className?: string }) {
  return (
    <span className={`sp-brackets ${className ?? ""}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
