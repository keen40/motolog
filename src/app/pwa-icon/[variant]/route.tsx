import { ImageResponse } from "next/og";

// App icons for the home screen, rendered once at build time.
//   any-192 / any-512   rounded icon
//   maskable-512        full-bleed background with the glyph in the safe zone (Android adaptive icons)
//   apple-180           iOS home screen (iOS rounds it itself)
const VARIANTS = {
  "any-192": { size: 192, radius: 0.22, glyph: 0.78 },
  "any-512": { size: 512, radius: 0.22, glyph: 0.78 },
  "maskable-512": { size: 512, radius: 0, glyph: 0.6 },
  "apple-180": { size: 180, radius: 0, glyph: 0.74 },
} as const;
type Variant = keyof typeof VARIANTS;

export const dynamic = "force-static";
export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[variant]">) {
  const { variant } = await ctx.params;
  const v = VARIANTS[variant as Variant];
  if (!v) return new Response("Not found", { status: 404 });
  const g = Math.round(v.size * v.glyph);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f59e0b",
          borderRadius: v.radius * v.size,
        }}
      >
        <svg width={g} height={g} viewBox="4 6 24 20">
          <circle cx="10" cy="20" r="5" fill="none" stroke="#000" strokeWidth="2.2" />
          <circle cx="23" cy="20" r="5" fill="none" stroke="#000" strokeWidth="2.2" />
          <path d="M10 20 L15 12 L21 12 L23 20 M15 12 L13 9" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: v.size, height: v.size },
  );
}
