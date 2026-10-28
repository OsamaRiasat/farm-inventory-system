"use client";

import { useId, useState } from "react";
import { fmtDate } from "@/lib/dates";

// Categorical slots 1–6 of the dataviz reference palette, validated on a white surface
// (adjacent CVD ΔE ≥ 9.1, normal-vision ≥ 19.6). Slots 3–5 are under 3:1 contrast, so the chart
// always has a legend and sits above its data table. Fixed order: a shed keeps its colour.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const W = 640;
const H = 220;
const PAD = { top: 12, right: 16, bottom: 28, left: 36 };

export type Series = { name: string; points: { date: string; value: number }[] };

/** Small line chart (one axis, thin lines, legend, crosshair tooltip). Up to 6 series. */
export function LineChart({ series, label }: { series: Series[]; label: string }) {
  const titleId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const shown = series.slice(0, SERIES.length);
  const dates = [...new Set(shown.flatMap((s) => s.points.map((p) => p.date)))].sort();
  if (dates.length === 0) return null;

  const max = Math.max(1, ...shown.flatMap((s) => s.points.map((p) => p.value)));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const x = (i: number) => PAD.left + (dates.length === 1 ? 0 : (i / (dates.length - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - v / top) * (H - PAD.top - PAD.bottom);
  const valueOn = (s: Series, date: string) => s.points.find((p) => p.date === date)?.value ?? 0;
  const labelEvery = Math.max(1, Math.ceil(dates.length / 7));

  return (
    <figure className="card p-4">
      <figcaption id={titleId} className="mb-2 text-sm font-semibold">
        {label}
      </figcaption>
      {shown.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {shown.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ background: SERIES[i] }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-labelledby={titleId}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - box.left) / box.width) * W;
            const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (dates.length - 1));
            setHover(Math.max(0, Math.min(dates.length - 1, i)));
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t)} dy="0.35em" textAnchor="end" fontSize={11} fill="var(--color-muted)">
                {t}
              </text>
            </g>
          ))}
          {dates.map((d, i) =>
            i % labelEvery === 0 || i === dates.length - 1 ? (
              <text key={d} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
                {d.slice(8, 10)}/{d.slice(5, 7)}
              </text>
            ) : null,
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-muted)" strokeWidth={1} />}
          {shown.map((s, si) => (
            <g key={s.name}>
              <polyline
                fill="none"
                stroke={SERIES[si]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={dates.map((d, i) => `${x(i)},${y(valueOn(s, d))}`).join(" ")}
              />
              <circle
                cx={x(hover ?? dates.length - 1)}
                cy={y(valueOn(s, dates[hover ?? dates.length - 1]))}
                r={4}
                fill={SERIES[si]}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            </g>
          ))}
        </svg>
        {hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 rounded-lg border border-line bg-surface p-2 text-xs shadow-lg"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > dates.length / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}
          >
            <div className="num mb-1 font-semibold">{fmtDate(dates[hover])}</div>
            {shown.map((s, si) => (
              <div key={s.name} className="flex items-center gap-2">
                <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: SERIES[si] }} />
                <span className="flex-1">{s.name}</span>
                <span className="num font-semibold">{valueOn(s, dates[hover])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10;
}
