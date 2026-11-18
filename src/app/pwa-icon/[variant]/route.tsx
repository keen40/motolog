import { ImageResponse } from "next/og";
import { LOGO_AMBER, LOGO_PATHS } from "@/lib/logo";

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
          background: LOGO_AMBER,
          borderRadius: v.radius * v.size,
        }}
      >
        {/* viewBox = the helmet's own bounds (centre ≈ 17.3, 16), so it fills the glyph area */}
        <svg width={g} height={g} viewBox="5.3 5 24 22">
          {LOGO_PATHS.map((p, i) => (
            <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" />
          ))}
        </svg>
      </div>
    ),
    { width: v.size, height: v.size },
  );
}
