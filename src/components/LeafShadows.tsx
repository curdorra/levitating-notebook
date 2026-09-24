/**
 * Soft, out-of-focus leaf shadows, like sunlight through a plant falling on
 * a desk. Generated from a seeded PRNG so server and client markup match.
 *
 * Each cluster is its own <svg> inside a wrapper that CSS animates with a
 * transform: the blur is rasterised once and then only moved by the GPU,
 * instead of being re-blurred on every frame.
 */
function prng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

type Branch = { x: number; y: number; angle: number; length: number; seed: number };

function leaves({ x, y, angle, length, seed }: Branch) {
  const rand = prng(seed);
  const out: React.ReactElement[] = [];
  const steps = Math.floor(length / 34);
  let cx = x;
  let cy = y;
  let a = angle;
  const stem: string[] = [`M${x},${y}`];

  for (let i = 0; i < steps; i++) {
    a += (rand() - 0.5) * 0.18;
    cx += Math.cos(a) * 34;
    cy += Math.sin(a) * 34;
    stem.push(`L${cx.toFixed(1)},${cy.toFixed(1)}`);

    const side = i % 2 === 0 ? 1 : -1;
    const spread = a + side * (0.7 + rand() * 0.5);
    const len = 30 + rand() * 26 + (i < steps * 0.7 ? 8 : -6);
    const lx = cx + Math.cos(spread) * len * 0.55;
    const ly = cy + Math.sin(spread) * len * 0.55;
    out.push(
      <ellipse
        key={i}
        cx={lx.toFixed(1)}
        cy={ly.toFixed(1)}
        rx={(len * 0.62).toFixed(1)}
        ry={(len * 0.22).toFixed(1)}
        transform={`rotate(${((spread * 180) / Math.PI).toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})`}
      />,
    );
  }

  return (
    <g key={seed}>
      <path d={stem.join(" ")} fill="none" strokeWidth={4} stroke="currentColor" />
      {out}
    </g>
  );
}

const CLUSTERS: Branch[][] = [
  [
    { x: -60, y: 40, angle: 0.35, length: 760, seed: 11 },
    { x: 120, y: -80, angle: 1.05, length: 520, seed: 23 },
    { x: -80, y: 360, angle: -0.1, length: 560, seed: 37 },
  ],
  [
    { x: 380, y: -60, angle: 0.8, length: 620, seed: 41 },
    { x: 40, y: 620, angle: -0.45, length: 480, seed: 53 },
  ],
];

export function LeafShadows() {
  return (
    <>
      {CLUSTERS.map((branches, i) => (
        <div key={i} className={`linen-leaves linen-leaves-${i}`}>
          <svg viewBox="0 0 1000 900" preserveAspectRatio="xMinYMin slice" aria-hidden="true">
            <defs>
              <filter id={`leaf-blur-${i}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="9" />
              </filter>
            </defs>
            <g filter={`url(#leaf-blur-${i})`} fill="currentColor" color="currentColor">
              {branches.map(leaves)}
            </g>
          </svg>
        </div>
      ))}
    </>
  );
}
