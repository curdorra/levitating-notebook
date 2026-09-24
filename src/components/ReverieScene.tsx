/**
 * Reverie's backdrop: colour fog over a glowing sea horizon, butterflies with
 * soft reflections in the water, a luminous cat, four-point stars and rising
 * specks of light. Everything animates with transform/opacity only, so the
 * GPU moves pre-rendered layers instead of repainting.
 */

export function Butterfly({ className, tint = "#ffffff" }: { className?: string; tint?: string }) {
  const wing = (
    <>
      <path d="M50 40 C 36 6, 6 4, 8 28 C 10 42, 34 45, 50 40 Z" />
      <path d="M50 43 C 32 48, 16 70, 28 74 C 40 77, 48 58, 50 45 Z" opacity="0.85" />
    </>
  );
  return (
    <svg className={className} viewBox="0 0 100 80" aria-hidden="true" style={{ color: tint }}>
      <g fill="currentColor">
        <g className="wing">{wing}</g>
        {/* Mirror on an outer group so the CSS flap on the inner one can't replace it. */}
        <g transform="translate(100 0) scale(-1 1)">
          <g className="wing">{wing}</g>
        </g>
        <ellipse cx="50" cy="42" rx="1.6" ry="11" />
      </g>
    </svg>
  );
}

export function Star({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 0 C12.8 8 16 11.2 24 12 C16 12.8 12.8 16 12 24 C11.2 16 8 12.8 0 12 C8 11.2 11.2 8 12 0 Z"
      />
    </svg>
  );
}

const STARS = [
  { top: "12vh", left: "10vw", size: 22, delay: 0 },
  { top: "8vh", left: "72vw", size: 16, delay: -1.2 },
  { top: "22vh", left: "88vw", size: 10, delay: -2.6 },
  { top: "30vh", left: "38vw", size: 8, delay: -0.7 },
  { top: "46vh", left: "6vw", size: 12, delay: -3.3 },
  { top: "18vh", left: "54vw", size: 9, delay: -4.1 },
  { top: "40vh", left: "94vw", size: 18, delay: -1.9 },
  { top: "82vh", left: "18vw", size: 9, delay: -2.2 },
  { top: "86vh", left: "22vw", size: 6, delay: -0.4 },
  { top: "88vh", left: "15vw", size: 7, delay: -3.7 },
];

const MOTES = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}vw`,
  size: 3 + ((i * 7) % 5),
  duration: 22 + ((i * 13) % 20),
  delay: -((i * 5.3) % 30),
}));

export function ReverieScene() {
  return (
    <>
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="blob blob-4" />
      <div className="blob blob-5" />

      <div className="rev-sea">
        <div className="rev-horizon" />
        <div className="rev-shimmer" />
      </div>

      <div className="rev-cat">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <filter id="rev-cat-soft" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
            <radialGradient id="rev-cat-fill" cx="50%" cy="60%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="75%" stopColor="#f1f5ff" />
              <stop offset="100%" stopColor="#c9d8fb" />
            </radialGradient>
          </defs>
          {/* Head with tall pointed ears and soft cheeks. */}
          <path
            filter="url(#rev-cat-soft)"
            fill="url(#rev-cat-fill)"
            d="M24 88 C18 70 20 52 26 40 L22 8 C22 5 25 4 27 6 L50 30 C56 28 64 28 70 30 L93 6 C95 4 98 5 98 8 L94 40 C100 52 102 70 96 88 C88 104 74 110 60 110 C46 110 32 104 24 88 Z"
          />
          <path d="M31 16 L44 30 L34 36 Z" fill="#f6c9c0" opacity="0.55" filter="url(#rev-cat-soft)" />
          <path d="M89 16 L76 30 L86 36 Z" fill="#f6c9c0" opacity="0.55" filter="url(#rev-cat-soft)" />
          <ellipse cx="45" cy="66" rx="5.5" ry="7" fill="#7aa6f2" />
          <ellipse cx="75" cy="66" rx="5.5" ry="7" fill="#7aa6f2" />
          <ellipse cx="45" cy="66" rx="1.6" ry="5" fill="#27407e" />
          <ellipse cx="75" cy="66" rx="1.6" ry="5" fill="#27407e" />
          <path d="M57 80 L63 80 L60 84 Z" fill="#f2a7a0" />
          <g stroke="#dbe5fb" strokeWidth="0.8" strokeLinecap="round" opacity="0.9">
            <path d="M40 84 L18 80" />
            <path d="M40 88 L18 90" />
            <path d="M80 84 L102 80" />
            <path d="M80 88 L102 90" />
          </g>
        </svg>
      </div>

      <div className="rev-flight rev-flight-1">
        <Butterfly className="rev-fly" tint="#f4f8ff" />
        <Butterfly className="rev-fly rev-reflection" tint="#dbe6ff" />
      </div>
      <div className="rev-flight rev-flight-2">
        <Butterfly className="rev-fly" tint="#ffd9cc" />
        <Butterfly className="rev-fly rev-reflection" tint="#ffe2d8" />
      </div>
      <div className="rev-flight rev-flight-3">
        <Butterfly className="rev-fly" tint="#6f9df0" />
      </div>

      {STARS.map((s, i) => (
        <Star
          key={i}
          className="rev-star"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
        />
      ))}

      {MOTES.map((m, i) => (
        <span
          key={i}
          className="rev-mote"
          style={{
            left: m.left,
            width: m.size,
            height: m.size,
            animationDuration: `${m.duration}s`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}
    </>
  );
}
