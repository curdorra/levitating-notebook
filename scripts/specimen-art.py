"""
Procedural x-ray botanicals for the Specimen theme.

Regenerate: python3 scripts/specimen-art.py <out-dir>  (needs numpy, pillow, scipy),
then encode the PNGs to public/specimen/*.webp.

Every shape (petal, leaf, wing, stem) is a polygon. For each one we take a
distance transform of its interior: a sharp exponential of that distance is
the bright rim, a wide one is the soft inner glow, and a little constant fill
is its film density. Summing all shapes and tone-mapping gives the layered,
translucent look of a radiograph where overlaps read brighter.

Outputs RGBA: a cool white whose alpha is the x-ray luminance, so the art
composites over any dark background with no blend mode.
"""

import math
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
TINT = np.array([0.90, 0.95, 1.0])


class Film:
    def __init__(self, w, h, seed):
        self.w, self.h = w, h
        self.acc = np.zeros((h, w), np.float32)
        self.rng = np.random.default_rng(seed)
        # Colour plate (for the "not.xray" reveal), painted back to front.
        self.rgb = np.zeros((h, w, 3), np.float32)
        self.alpha = np.zeros((h, w), np.float32)

    def _mask(self, pts, pad=40):
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        x0 = max(int(min(xs)) - pad, 0)
        y0 = max(int(min(ys)) - pad, 0)
        x1 = min(int(max(xs)) + pad, self.w)
        y1 = min(int(max(ys)) + pad, self.h)
        if x1 <= x0 or y1 <= y0:
            return None
        # Draw at 2x and box-filter down for clean edges.
        img = Image.new("L", ((x1 - x0) * 2, (y1 - y0) * 2), 0)
        ImageDraw.Draw(img).polygon([((x - x0) * 2, (y - y0) * 2) for x, y in pts], fill=255)
        m = np.asarray(img.resize((x1 - x0, y1 - y0), Image.BOX), np.float32) / 255
        return m, (slice(y0, y1), slice(x0, x1)), (x0, y0)

    def shape(self, pts, rim=1.0, glow=0.32, fill=0.09, rim_w=2.2, glow_w=16, veins=(), vein_i=0.5,
              color=None, shade=None, band=0.0, band_at=18):
        got = self._mask(pts)
        if got is None:
            return
        m, sl, (x0, y0) = got
        d = ndimage.distance_transform_edt(m > 0.5).astype(np.float32)
        v = np.zeros_like(m)
        if veins:
            img = Image.new("L", (m.shape[1] * 2, m.shape[0] * 2), 0)
            dr = ImageDraw.Draw(img)
            for line, width in veins:
                dr.line([((x - x0) * 2, (y - y0) * 2) for x, y in line], fill=255, width=max(1, int(width * 2)))
            v = np.asarray(img.resize((m.shape[1], m.shape[0]), Image.BOX), np.float32) / 255
            v = ndimage.gaussian_filter(v, 0.6) * m
        contrib = m * (rim * np.exp(-d / rim_w) + glow * np.exp(-d / glow_w) + fill
                       + band * np.exp(-(((d - band_at) / 3) ** 2))) + vein_i * v
        self.acc[sl] += contrib
        if color is not None:
            self._paint(m, sl, d, v, color, shade)

    def _paint(self, m, sl, d, v, color, shade):
        # Soft contact shadow on what's underneath, then the petal on top.
        sh = ndimage.gaussian_filter(m, 7)
        sh = np.roll(sh, (5, 3), (0, 1))
        self.rgb[sl] *= (1 - 0.38 * sh * (1 - m))[..., None]
        base, tip = np.array(color[0]), np.array(color[1])
        depth = np.clip(d / 26, 0, 1)
        c = tip[None, None] * (1 - depth[..., None]) + base[None, None] * depth[..., None]
        if shade is not None:
            c = c * shade
        c = c * (0.86 + 0.14 * np.exp(-d / 3))[..., None] - 0.1 * v[..., None]
        a = m
        self.rgb[sl] = self.rgb[sl] * (1 - a[..., None]) + c * a[..., None]
        self.alpha[sl] = np.maximum(self.alpha[sl], a)

    def line(self, pts, width, intensity=0.6):
        img = Image.new("L", (self.w, self.h), 0)
        ImageDraw.Draw(img).line(pts, fill=255, width=width)
        l = np.asarray(img, np.float32) / 255
        self.acc += ndimage.gaussian_filter(l, 0.7) * intensity

    def xray(self, gain=1.15, bloom=0.4, grain=0.0):
        L = 1 - np.exp(-self.acc * gain)
        L = L + bloom * ndimage.gaussian_filter(L, 9) + bloom * 0.4 * ndimage.gaussian_filter(L, 40)
        L = L * (1 + grain * self.rng.standard_normal(L.shape).astype(np.float32))
        L = np.clip(L, 0, 1) ** 1.05
        rgba = np.zeros((self.h, self.w, 4), np.uint8)
        rgba[..., :3] = (TINT * 255).astype(np.uint8)
        rgba[..., 3] = (L * 255).astype(np.uint8)
        return Image.fromarray(rgba)

    def colour(self):
        a = ndimage.gaussian_filter(self.alpha, 0.5)
        rgb = np.clip(self.rgb, 0, 1)
        rgb = rgb * (1 + 0.0 * self.rng.standard_normal(rgb.shape[:2]).astype(np.float32))[..., None]
        out = np.zeros((self.h, self.w, 4), np.uint8)
        out[..., :3] = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
        out[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
        return Image.fromarray(out)


def rot(x, y, a):
    c, s = math.cos(a), math.sin(a)
    return x * c - y * s, x * s + y * c


def petal(rng, cx, cy, angle, length, width, squash=0.72, lift=0.0, ruffle=0.07, lobes=5, n=70, cup=0.0):
    """Ovate petal from (cx, cy) outwards along `angle`; ruffled, notched tip.
    `squash` tilts the flower disc; `lift` makes inner petals rise upward."""
    phase = rng.uniform(0, 6.28, 4)
    def half_w(u):
        u = min(u, 1)
        return width / 2 * (u ** 0.55) * (1 - 0.38 * u ** 5) * (1 + cup * u)

    def rim(u):
        return 1 + ruffle * (math.sin(u * 17 + phase[0]) * 0.6 + math.sin(u * 31 + phase[1]) * 0.4)

    side_r, side_l, tip = [], [], []
    for i in range(n + 1):
        u = i / n * 0.94
        w = half_w(u)
        side_r.append((u * length, w * rim(u)))
        side_l.append((u * length, -w * rim(u + 0.5)))
    for i in range(n + 1):
        t = i / n
        vv = 1 - 2 * t  # +1 .. -1
        bulge = 0.2 * math.sqrt(max(0, 1 - vv * vv))
        notch = ruffle * 0.45 * math.sin((vv + 1) * math.pi * lobes / 2 + phase[2]) ** 2 * (1 - vv * vv)
        u = 0.94 + bulge - notch
        tip.append((u * length, vv * half_w(0.94) * rim(0.94)))
    outline = side_r + tip + side_l[::-1]

    # Lift: a petal that rises out of the disc is shortened and pushed up.
    pts = []
    for x, y in outline:
        px, py = rot(x, y, angle)
        u = x / length
        pts.append((cx + px, cy + py * squash - lift * u))

    veins = []
    for k in np.linspace(-0.78, 0.78, 9):
        line = []
        for i in range(24):
            u = i / 23 * 0.86
            y = k * half_w(u) * 0.92
            px, py = rot(u * length, y, angle)
            line.append((cx + px, cy + py * squash - lift * u / 0.86 * 0.94))
        veins.append((line, 0.7 if abs(k) > 0.1 else 1.1))
    return pts, veins


def peony(w=1300, h=1750, seed=3):
    rng = np.random.default_rng(seed)
    f = Film(w, h, seed)
    cx, cy = w * 0.5, h * 0.36

    # Stem + leaves first, so the bloom paints over them.
    stem = [(cx + 6 * math.sin(t * 2.4) + t * 60, cy + 40 + t * (h - cy)) for t in np.linspace(0, 1, 40)]
    stem_poly = [(x + 13 - 3 * i / 40, y) for i, (x, y) in enumerate(stem)] + [
        (x - 13 + 3 * i / 40, y) for i, (x, y) in list(enumerate(stem))[::-1]
    ]
    f.shape(stem_poly, rim=0.9, glow=0.25, fill=0.1, glow_w=8,
            veins=[([(x, y) for x, y in stem], 1.0)], vein_i=0.3,
            color=((0.38, 0.47, 0.33), (0.52, 0.62, 0.45)))
    for base_t, side, ang, L, W in [(0.34, -1, -2.45, 430, 150), (0.46, 1, -0.55, 470, 160),
                                    (0.62, -1, -2.75, 380, 130), (0.72, 1, -0.3, 330, 120)]:
        i = int(base_t * 39)
        bx, by = stem[i]
        pts, veins = leaf(bx, by, ang, L, W, rng)
        f.shape(pts, rim=1.0, glow=0.3, fill=0.08, veins=veins, vein_i=0.55,
                color=((0.36, 0.46, 0.34), (0.55, 0.64, 0.48)))

    pink_out = ((0.93, 0.70, 0.76), (0.99, 0.90, 0.92))
    pink_mid = ((0.90, 0.58, 0.68), (0.99, 0.85, 0.88))
    pink_in = ((0.82, 0.40, 0.54), (0.97, 0.76, 0.82))

    # Outer ring: big, low, spread wide.
    rings = [
        (11, 470, 330, 0.66, 0.0, 0.08, pink_out, 0.0),
        (10, 390, 300, 0.70, 60, 0.09, pink_out, 0.3),
        (9, 300, 250, 0.76, 120, 0.10, pink_mid, 0.15),
        (8, 230, 210, 0.82, 150, 0.12, pink_mid, 0.45),
        (7, 160, 170, 0.88, 180, 0.14, pink_in, 0.2),
    ]
    # Back half of each ring first so front petals overlap them.
    for count, L, W, sq, lift, ruf, col, off in rings:
        angles = [(-math.pi / 2 + (i + off + rng.uniform(-0.18, 0.18)) * 2 * math.pi / count) for i in range(count)]
        angles.sort(key=lambda a: math.sin(a))  # far (up) side first
        for a in angles:
            ll = L * rng.uniform(0.86, 1.1)
            ww = W * rng.uniform(0.85, 1.12)
            pts, veins = petal(rng, cx + rng.uniform(-10, 10), cy + rng.uniform(-8, 8), a, ll, ww,
                               squash=sq, lift=lift * (0.5 + 0.5 * max(0, -math.sin(a))), ruffle=ruf,
                               lobes=rng.integers(3, 7), cup=0.25)
            shade = 0.86 + 0.14 * max(0, math.sin(a))
            f.shape(pts, glow=0.2, fill=0.05, veins=veins, vein_i=0.38, color=col, shade=shade)

    # Ruffled heart: many small crumpled petals.
    for i in range(18):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(0, 45)
        px, py = cx + r * math.cos(a), cy - 170 + r * math.sin(a) * 0.6
        pts, veins = petal(rng, px, py, rng.uniform(-math.pi, 0), rng.uniform(60, 120), rng.uniform(70, 130),
                           squash=0.9, lift=rng.uniform(10, 50), ruffle=0.2, lobes=rng.integers(4, 9), cup=0.4)
        f.shape(pts, rim=0.7, glow=0.12, fill=0.03, rim_w=1.6, glow_w=8, veins=veins[::3], vein_i=0.25,
                color=pink_in, shade=0.95)
    return f


def leaf(bx, by, ang, L, W, rng):
    pts = []
    n = 60
    ph = rng.uniform(0, 6)
    for i in range(n + 1):
        u = i / n
        w = W / 2 * math.sin(math.pi * u ** 0.85) * (1 + 0.03 * math.sin(u * 40 + ph))
        pts.append(rot(u * L, w, ang))
    for i in range(n, -1, -1):
        u = i / n
        w = W / 2 * math.sin(math.pi * u ** 0.85) * (1 + 0.03 * math.sin(u * 37 + ph))
        pts.append(rot(u * L, -w * 0.9, ang))
    pts = [(bx + x, by + y) for x, y in pts]
    veins = [([(bx + x, by + y) for x, y in [rot(u * L, 0, ang) for u in np.linspace(0, 0.97, 30)]], 1.6)]
    for u0 in np.linspace(0.12, 0.8, 8):
        for s in (1, -0.9):
            line = []
            for t in np.linspace(0, 1, 10):
                u = u0 + t * 0.16
                w = W / 2 * math.sin(math.pi * min(u, 1) ** 0.85) * 0.85 * t * s
                line.append(rot(u * L, w, ang))
            veins.append(([(bx + x, by + y) for x, y in line], 0.7))
    return pts, veins


def butterfly(w=1100, h=900, seed=8):
    """Seen from above, slightly angled; x-ray only."""
    f = Film(w, h, seed)
    cx, cy = w * 0.5, h * 0.5

    def wing(points, cells):
        pts = [(cx + x, cy + y) for x, y in points]
        vs = [([(cx + x, cy + y) for x, y in c], 0.9) for c in cells]
        return pts, vs

    def bez(p0, p1, p2, p3, n=30):
        out = []
        for t in np.linspace(0, 1, n):
            a = (1 - t) ** 3
            b = 3 * (1 - t) ** 2 * t
            c = 3 * (1 - t) * t * t
            d = t ** 3
            out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
        return out

    for side in (-1, 1):
        s = side
        fore = bez((0, -20), (s * 60, -300), (s * 330, -380), (s * 470, -300)) + \
            bez((s * 470, -300), (s * 500, -200), (s * 420, -60), (s * 300, 10)) + \
            bez((s * 300, 10), (s * 200, 30), (s * 60, 20), (0, 10))
        hind = bez((0, 10), (s * 120, 20), (s * 330, 60), (s * 360, 190)) + \
            bez((s * 360, 190), (s * 380, 310), (s * 250, 400), (s * 150, 390)) + \
            bez((s * 150, 390), (s * 60, 380), (s * 20, 200), (0, 30))
        fv = [bez((0, -5), (s * 100, -120 - k * 30), (s * (250 + k * 40), -260 + k * 60), (s * (330 + k * 35), -300 + k * 95))
              for k in range(5)]
        fv += [bez((s * 150, -150), (s * 220, -170), (s * 280, -150), (s * 330, -110))]
        hv = [bez((0, 20), (s * 90, 60 + k * 40), (s * (200 + k * 10), 120 + k * 60), (s * (330 - k * 45), 170 + k * 55))
              for k in range(5)]
        for pts, veins in (wing(hind, hv), wing(fore, fv)):
            f.shape(pts, rim=1.1, glow=0.3, fill=0.1, rim_w=2.4, glow_w=24, veins=veins, vein_i=0.85, band=0.45, band_at=22)
    # Body segments + antennae.
    for i, (ry, rx, yy) in enumerate([(40, 22, -60), (70, 26, 20), (120, 20, 150)]):
        pts = [(cx + rx * math.cos(t), cy + yy + ry * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 60)]
        f.shape(pts, rim=1.0, glow=0.5, fill=0.25, glow_w=8)
    for s in (-1, 1):
        f.line(bez((cx, cy - 95), (cx + s * 30, cy - 200), (cx + s * 80, cy - 260), (cx + s * 110, cy - 300)), 2, 0.8)
    return f


def lily(w=1000, h=1500, seed=21):
    """A cosmos-like open flower with long pointed petals, stem and bud."""
    rng = np.random.default_rng(seed)
    f = Film(w, h, seed)
    cx, cy = w * 0.5, h * 0.33
    stem = [(cx - 30 * math.sin(t * 2.2) - t * 40, cy + t * (h - cy)) for t in np.linspace(0, 1, 40)]
    f.line(stem, 12, 0.35)
    f.shape([(x + 8, y) for x, y in stem] + [(x - 8, y) for x, y in stem[::-1]], rim=0.8, glow=0.2, fill=0.1)
    for bt, ang, L, W in [(0.45, -0.7, 380, 90), (0.6, -2.5, 340, 80)]:
        bx, by = stem[int(bt * 39)]
        pts, veins = leaf(bx, by, ang, L, W, rng)
        f.shape(pts, veins=veins, vein_i=0.5)
    for ring, (count, L, W, off) in enumerate([(6, 400, 150, 0), (6, 340, 120, 0.5)]):
        for i in range(count):
            a = -math.pi / 2 + (i + off) * 2 * math.pi / count + rng.uniform(-0.1, 0.1)
            pts, veins = petal(rng, cx, cy, a, L * rng.uniform(0.9, 1.08), W, squash=0.8, ruffle=0.03, lobes=2,
                               cup=-0.35, lift=20 * ring)
            f.shape(pts, veins=veins, vein_i=0.5)
    for i in range(14):
        a = -math.pi / 2 + rng.uniform(-1.2, 1.2)
        L = rng.uniform(90, 150)
        end = (cx + L * math.cos(a), cy - 30 + L * math.sin(a) * 0.9)
        f.line([(cx, cy), ((cx + end[0]) / 2 + rng.uniform(-8, 8), (cy + end[1]) / 2), end], 2, 0.7)
        f.shape([(end[0] + 7 * math.cos(t), end[1] + 4 * math.sin(t)) for t in np.linspace(0, 6.3, 20)],
                rim=1.0, glow=0.6, fill=0.3, rim_w=1.5, glow_w=4)
    return f


def save(img, name, scale=1.0):
    if scale != 1.0:
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    img.save(f"{OUT}/{name}.png")
    print(name, img.size)


if __name__ == "__main__":
    p = peony()
    save(p.xray(gain=0.62, bloom=0.2), "peony-xray")
    save(p.colour(), "peony-colour")
    save(butterfly().xray(), "butterfly-xray", 0.8)
    save(lily().xray(), "lily-xray")
