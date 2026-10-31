"use client";

import { useId, useState } from "react";
import { price, usd } from "./usage";

// How the overcharge grows with cache hit rate, for 1M input + 10k output tokens.
export default function CacheSlider() {
  const id = useId();
  const [hit, setHit] = useState(90);
  const input = 1_000_000;
  const output = 10_000;
  const cached = Math.round((input * hit) / 100);
  const before = price(input, cached, output);
  const after = price(input - cached, cached, output);
  const factor = after > 0 ? before / after : 1;

  return (
    <div className="self-start rounded-xl border border-line bg-panel p-5">
      <label htmlFor={id} className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        Cache hit rate: {hit}%
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={99}
        value={hit}
        onChange={(e) => setHit(Number(e.target.value))}
        className="mt-3 w-full accent-[#d6b83c]"
      />
      <div className="mt-4 grid grid-cols-3 gap-3 font-mono text-sm">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted">Recorded today</div>
          <div className="mt-1 text-bad">{usd(before)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted">With fix</div>
          <div className="mt-1 text-good">{usd(after)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted">Over by</div>
          <div className="mt-1">{factor.toFixed(1)}×</div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        1M input + 10k output tokens at the same rates. Long agent sessions re-send their context each turn, so hit rates
        above 90% are normal.
      </p>
    </div>
  );
}
