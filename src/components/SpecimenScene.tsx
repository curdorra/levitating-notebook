import { Glyph } from "./SpecimenDeco";

// Everything on the plate is placed in the peony image's own pixels
// (1300 × 1750), so the annotations stay pinned to the petals at any size.
const W = 1300;
const H = 1750;

type Pt = [number, number];
const NODES: Record<string, Pt> = {
  a: [-250, 250],
  b: [-110, 540],
  c: [70, 860],
  d: [1130, 300],
  e: [1170, 790],
  f: [560, 1190],
  g: [250, 1440],
  box1: [430, 330],
  box2: [900, 330],
  box3: [430, 800],
  box4: [900, 800],
};
const EDGES: [string, string][] = [
  ["a", "b"],
  ["b", "box1"],
  ["box2", "d"],
  ["d", "e"],
  ["e", "box4"],
  ["box3", "c"],
  ["b", "c"],
  ["c", "f"],
  ["f", "g"],
];
// Translucent tinted squares: [x, y, size, tone].
const TILES: [number, number, number, "pink" | "cyan"][] = [
  [960, 380, 70, "cyan"],
  [150, 1010, 58, "pink"],
  [1030, 650, 48, "pink"],
  [-60, 700, 40, "cyan"],
];
// Nodes that blink, as if the scanner is locking on.
const BLINK: Pt[] = [
  [900, 330],
  [70, 860],
  [1170, 790],
];

const pct = ([x, y]: Pt) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });

/**
 * Specimen's backdrop: a radiograph plate. An x-ray peony with one window
 * showing it in true colour ("not.xray"), a butterfly caught in a bounding
 * box, a network of hairlines and nodes, a slow scan line and the odd
 * glitched slice.
 */
export function SpecimenScene() {
  return (
    <>
      <div className="sp-vignette" />
      <div className="sp-grid" />

      <div className="sp-plate">
        <svg className="sp-orbits" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <circle cx="650" cy="560" r="760" />
          <circle cx="650" cy="560" r="930" className="sp-orbit-dash" />
          <circle cx="-200" cy="-120" r="520" />
        </svg>

        <div className="sp-img sp-butterfly" />
        <div className="sp-img sp-peony" />
        <div className="sp-img sp-peony-colour" />
        <div className="sp-img sp-peony sp-glitch sp-glitch-1" />
        <div className="sp-img sp-peony sp-glitch sp-glitch-2" />
        <div className="sp-img sp-peony sp-glitch sp-glitch-3" />

        <svg className="sp-network" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <g className="sp-net-lines">
            {EDGES.map(([p, q]) => (
              <line key={p + q} x1={NODES[p][0]} y1={NODES[p][1]} x2={NODES[q][0]} y2={NODES[q][1]} />
            ))}
          </g>
          {/* flowers.jpeg: the big box around the bloom's heart */}
          <rect className="sp-net-box" x="430" y="330" width="470" height="470" />
          {/* not.xray: the window where the true colour shows through */}
          <rect className="sp-net-box sp-net-reveal" x="520" y="430" width="290" height="290" />
          {/* the butterfly's box */}
          <rect className="sp-net-box" x="-150" y="120" width="330" height="300" />

          {TILES.map(([x, y, s, tone]) => (
            <rect key={`${x},${y}`} className={`sp-net-tile sp-net-tile-${tone}`} x={x} y={y} width={s} height={s} />
          ))}
          <g className="sp-net-nodes">
            {Object.values(NODES).map(([x, y]) => (
              <rect key={`${x},${y}`} x={x - 6} y={y - 6} width="12" height="12" />
            ))}
          </g>
        </svg>

        {BLINK.map((p, i) => (
          <i key={i} className="sp-blink" style={{ ...pct(p), animationDelay: `${i * -1.7}s` }} />
        ))}

        <div className="sp-scan">
          <i />
        </div>
      </div>

      <Glyph className="sp-corner-glyph" />
    </>
  );
}
