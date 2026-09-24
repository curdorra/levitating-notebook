import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif, Manrope, Newsreader } from "next/font/google";

// UI text in every theme.
export const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

// Linen: a quiet book serif.
export const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

// Theme-only faces load when first used rather than on every page.

// Specimen: scan-label mono for display and captions, its sans sibling for
// writing. Plex Mono is also the code face in every theme.
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  preload: false,
});
export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-plex-sans",
  preload: false,
});

// Reverie: soft italic display.
export const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  preload: false,
});

export const fontVariables = [manrope, newsreader, plexMono, plexSans, instrument].map((f) => f.variable).join(" ");
