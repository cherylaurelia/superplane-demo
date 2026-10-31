// Mirrors SuperPlane's pricebook math (ee/billing/pricebook/pricebook.go):
// micros(tokens, centsPerMillion) = tokens * centsPerMillion * 10_000 / 1_000_000
export const RATES = { input: 1000, output: 5000, cacheRead: 100 }; // gpt-6-astra @ 2026-09-23.1, cents per million

export const micros = (tokens: number, centsPerMillion: number) =>
  tokens <= 0 || centsPerMillion <= 0 ? 0 : Math.floor((tokens * centsPerMillion * 10_000) / 1_000_000);

// One Codex "Implement" step, numbers from superplane#9049.
export const RUN = { input: 56_305_375, cached: 55_524_598, output: 223_089 };

export function price(inputBilledAtFullRate: number, cached: number, output: number) {
  return (
    micros(inputBilledAtFullRate, RATES.input) + micros(output, RATES.output) + micros(cached, RATES.cacheRead)
  );
}

// Same rounding as web_src/src/lib/formatTokenCount.ts
export function compactTokens(tokens: number): string {
  const strip = (s: string) => s.replace(/\.0$/, "");
  if (tokens >= 1_000_000_000) return `${strip((tokens / 1_000_000_000).toFixed(1))}B`;
  if (tokens >= 1_000_000) return `${strip((tokens / 1_000_000).toFixed(1))}M`;
  if (tokens >= 1_000) return `${strip((tokens / 1_000).toFixed(1))}k`;
  return `${tokens}`;
}

export const usd = (m: number) => `$${(m / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
