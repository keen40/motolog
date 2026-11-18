"use client";

import { createContext, useContext } from "react";
import { useI18n } from "@/lib/i18n/client";
import type { ZoneId } from "@/lib/types";

export type ZoneState = "stock" | "serviced" | "modified" | "planned";

const PALETTE: Record<ZoneState, { fill: string; stroke: string; solid: string; dash?: string }> = {
  stock: { fill: "#232329", stroke: "#5b5b66", solid: "#3a3a42" },
  serviced: { fill: "rgba(56,189,248,0.28)", stroke: "#38bdf8", solid: "#38bdf8" },
  modified: { fill: "rgba(245,158,11,0.38)", stroke: "#f59e0b", solid: "#f59e0b" },
  planned: { fill: "rgba(167,139,250,0.18)", stroke: "#a78bfa", solid: "#a78bfa", dash: "7 5" },
};

type Props = {
  states: Partial<Record<ZoneId, ZoneState>>;
  selected?: ZoneId | null;
  onSelect?: (zone: ZoneId | null) => void;
  counts?: Partial<Record<ZoneId, number>>;
};

type ZoneCtx = Props & { label: (id: ZoneId) => string };
const DiagramCtx = createContext<ZoneCtx | null>(null);

function Zone({ id, children }: { id: ZoneId; children: React.ReactNode }) {
  const { states, selected, onSelect, counts, label } = useContext(DiagramCtx)!;
  const interactive = !!onSelect;
  const state = states[id] ?? "stock";
  const p = PALETTE[state];
  const isSel = selected === id;
  const dim = selected && !isSel;
  return (
    <g
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={label(id)}
      onClick={interactive ? () => onSelect!(isSel ? null : id) : undefined}
      onKeyDown={interactive ? (e) => (e.key === "Enter" || e.key === " ") && onSelect!(isSel ? null : id) : undefined}
      className={`transition-opacity outline-none ${interactive ? "cursor-pointer hover:brightness-150 focus-visible:brightness-150" : ""}`}
      style={
        {
          "--z-fill": p.fill,
          "--z-stroke": isSel ? "#ffffff" : p.stroke,
          "--z-solid": p.solid,
          "--z-dash": p.dash ?? "none",
          opacity: dim ? 0.35 : 1,
        } as React.CSSProperties
      }
    >
      <title>{`${label(id)}${counts?.[id] ? ` · ${counts[id]}` : ""}`}</title>
      {children}
    </g>
  );
}

export function BikeDiagram({ states, selected, onSelect, counts }: Props) {
  const { t } = useI18n();
  // Shared shape props
  const area = { fill: "var(--z-fill)", stroke: "var(--z-stroke)", strokeWidth: 2.5, strokeDasharray: "var(--z-dash)", strokeLinejoin: "round" as const };
  const line = { fill: "none", stroke: "var(--z-solid)", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return (
    <DiagramCtx.Provider value={{ states, selected, onSelect, counts, label: (id) => t.zones[id] }}>
    <div>
      <svg viewBox="40 40 760 440" className="h-auto w-full select-none" role="img" aria-label={t.diagram.title}>
        {/* ground shadow */}
        <ellipse cx="410" cy="462" rx="330" ry="10" fill="#000" opacity="0.35" />

        <Zone id="wheels">
          {[
            [190, 360, 92],
            [640, 360, 96],
          ].map(([cx, cy, r]) => (
            <g key={cx}>
              <circle cx={cx} cy={cy} r={r} {...line} strokeWidth={20} strokeDasharray="var(--z-dash)" />
              <circle cx={cx} cy={cy} r={r - 14} fill="none" stroke="var(--z-stroke)" strokeWidth={3} />
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return (
                  <line
                    key={i}
                    x1={cx + Math.cos(a) * 14}
                    y1={cy + Math.sin(a) * 14}
                    x2={cx + Math.cos(a + 0.5) * (r - 16)}
                    y2={cy + Math.sin(a + 0.5) * (r - 16)}
                    stroke="var(--z-stroke)"
                    strokeWidth={1.2}
                    opacity={0.6}
                  />
                );
              })}
              <circle cx={cx} cy={cy} r={12} {...area} />
            </g>
          ))}
        </Zone>

        <Zone id="brakes">
          <circle cx="190" cy="360" r="34" {...area} fillOpacity={0.6} />
          <circle cx="640" cy="360" r="40" {...area} fillOpacity={0.6} />
          <rect x="200" y="318" width="26" height="16" rx="4" transform="rotate(-25 213 326)" {...area} />
          <rect x="606" y="320" width="26" height="18" rx="4" transform="rotate(20 619 329)" {...area} />
        </Zone>

        <Zone id="frame">
          {/* swingarm */}
          <path d="M360 300 L372 318 L196 372 L184 350 Z" {...area} />
          {/* main frame & subframe */}
          <path
            d="M560 128 L548 120 L470 175 L388 205 L360 300 M560 128 L500 320 L470 340 L390 320 L360 300 M388 205 L250 172 M370 268 L250 172"
            {...line}
            stroke="var(--z-stroke)"
            strokeWidth={9}
            strokeDasharray="var(--z-dash)"
          />
          <circle cx="360" cy="300" r="9" {...area} />
        </Zone>

        <Zone id="drivetrain">
          <path
            d="M352 300 L192 318 A44 44 0 0 0 194 404 L352 326"
            fill="none"
            stroke="var(--z-solid)"
            strokeWidth={5}
            strokeDasharray="var(--z-dash) "
          />
          <path d="M352 300 L192 318 A44 44 0 0 0 194 404 L352 326" fill="none" stroke="#000" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.5} />
          <circle cx="190" cy="360" r="44" fill="none" stroke="var(--z-stroke)" strokeWidth={3} strokeDasharray="4 3" />
          <circle cx="352" cy="313" r="14" {...area} />
        </Zone>

        <Zone id="suspension_rear">
          <path d="M338 196 L306 300" {...line} strokeWidth={12} stroke="var(--z-fill)" />
          <path
            d="M334 212 l-14 4 l12 6 l-14 4 l12 6 l-14 4 l12 6 l-14 4 l12 6 l-14 4 l12 6 l-14 4"
            fill="none"
            stroke="var(--z-stroke)"
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <circle cx="338" cy="196" r="6" {...area} />
          <circle cx="306" cy="300" r="6" {...area} />
        </Zone>

        <Zone id="engine">
          {/* crankcase */}
          <path d="M372 252 L478 246 Q500 280 482 322 L396 332 Q366 300 372 252 Z" {...area} />
          <circle cx="440" cy="292" r="22" fill="none" stroke="var(--z-stroke)" strokeWidth={2} />
          {/* cylinder with fins */}
          <path d="M400 252 L408 176 L470 172 L476 248 Z" {...area} />
          {[188, 202, 216, 230].map((y) => (
            <line key={y} x1="402" y1={y} x2="476" y2={y - 3} stroke="var(--z-stroke)" strokeWidth={1.5} opacity={0.7} />
          ))}
          {/* radiator */}
          <rect x="478" y="168" width="40" height="78" rx="4" transform="rotate(-18 498 207)" {...area} />
        </Zone>

        <Zone id="intake">
          {/* airbox */}
          <path d="M268 182 L344 192 L352 248 L280 238 Z" {...area} />
          {/* carburettor */}
          <rect x="350" y="206" width="40" height="30" rx="6" {...area} />
          <rect x="360" y="190" width="18" height="18" rx="3" {...area} />
        </Zone>

        <Zone id="exhaust">
          {/* expansion chamber */}
          <path
            d="M470 206 C520 214 540 252 520 280 C500 312 420 282 380 262 C340 244 320 228 300 222 L292 236 C320 244 350 262 380 280 C430 306 520 330 540 280 C556 240 520 202 474 196 Z"
            {...area}
          />
          {/* silencer */}
          <rect x="120" y="200" width="168" height="30" rx="14" transform="rotate(8 204 215)" {...area} />
          <rect x="112" y="204" width="16" height="22" rx="4" transform="rotate(8 120 215)" fill="var(--z-solid)" />
        </Zone>

        <Zone id="fuel">
          <path d="M432 150 Q470 124 530 132 L540 166 Q490 176 440 172 Z" {...area} />
          <rect x="474" y="128" width="16" height="7" rx="2" fill="var(--z-solid)" />
        </Zone>

        <Zone id="plastics">
          {/* seat */}
          <path d="M240 160 Q330 150 440 150 Q470 150 482 160 L476 172 Q360 168 246 176 Z" {...area} />
          {/* rear fender + side panel */}
          <path d="M70 150 Q160 152 250 168 L330 186 L344 226 L262 214 Q170 186 74 162 Z" {...area} />
          {/* radiator shroud */}
          <path d="M440 168 L540 160 L566 172 L540 236 L496 252 Q470 214 440 168 Z" {...area} />
          {/* front number plate */}
          <path d="M566 104 L606 118 L590 186 L556 170 Z" {...area} />
          {/* front fender */}
          <path d="M590 226 Q660 214 740 236 L736 248 Q664 232 596 244 Z" {...area} />
        </Zone>

        <Zone id="suspension_front">
          <path d="M560 128 L640 360" {...line} stroke="var(--z-fill)" strokeWidth={26} />
          <path d="M560 128 L640 360" fill="none" stroke="var(--z-stroke)" strokeWidth={2} strokeDasharray="var(--z-dash)" />
          <path d="M600 244 L640 360" {...line} stroke="var(--z-solid)" strokeWidth={14} />
          <rect x="544" y="116" width="34" height="12" rx="3" transform="rotate(20 561 122)" {...area} />
        </Zone>

        <Zone id="controls">
          <path d="M540 92 Q562 98 590 86" {...line} strokeWidth={7} />
          <path d="M556 96 L560 118" {...line} strokeWidth={6} />
          <path d="M590 86 l14 -6" {...line} strokeWidth={9} />
          {/* foot peg & levers */}
          <rect x="380" y="330" width="30" height="8" rx="3" {...area} />
          <path d="M540 92 l-26 10" {...line} strokeWidth={3} />
        </Zone>

        <Zone id="electrical">
          <rect x="430" y="158" width="12" height="18" rx="2" {...area} />
          <path d="M436 158 Q430 140 404 150" fill="none" stroke="var(--z-stroke)" strokeWidth={2.5} />
          <circle cx="410" cy="292" r="12" {...area} />
        </Zone>
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-muted">
        {(Object.keys(PALETTE) as ZoneState[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm border"
              style={{
                background: PALETTE[s].fill,
                borderColor: PALETTE[s].stroke,
                borderStyle: PALETTE[s].dash ? "dashed" : "solid",
              }}
            />
            {t.diagram[s]}
          </span>
        ))}
      </div>
    </div>
    </DiagramCtx.Provider>
  );
}
