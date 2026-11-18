/** MotoLog logo: a motocross helmet in side view (shell, peak, goggle port, chin bar), black on amber. */
export const LOGO_AMBER = "#f59e0b";

/** Paths in a 32×32 box (the glyph is drawn shifted by LOGO_SHIFT to sit centred). */
export const LOGO_PATHS: { d: string; fill: string; stroke?: string; strokeWidth?: number }[] = [
  // shell + chin bar
  {
    d: "M6.6 21.4 C5.2 15.2 8.6 7.6 16.4 7.4 C19 7.35 20.9 8 22.1 9.2 L22.7 12.2 L21.9 16.4 L28.1 19.7 C28.5 19.9 28.6 20.4 28.3 20.8 L27 22.6 C26.8 22.9 26.5 23.1 26.1 23.1 L17.6 23.7 L10.6 24.4 C8.7 24.6 7 23.3 6.6 21.4 Z",
    fill: "#000",
  },
  // goggle port
  { d: "M15.6 12.9 C15.6 12.4 16 12 16.5 12 L21.6 12 L21 16.4 C20.95 16.8 20.6 17.1 20.2 17.1 L16.8 17.3 C16.2 17.3 15.7 16.9 15.7 16.3 Z", fill: LOGO_AMBER },
  // peak
  { d: "M17.8 8.4 L28.6 9.3 C29 9.35 29.1 9.8 28.8 10 L23.6 12.9 C23.3 13.1 22.9 13 22.7 12.7 Z", fill: "#000" },
  // shell stripe
  { d: "M8.3 17.4 C8.9 13.6 11.6 10.4 15.4 9.7", fill: "none", stroke: LOGO_AMBER, strokeWidth: 1.3 },
];

export const LOGO_SHIFT = { x: -0.9, y: 0.2 };
