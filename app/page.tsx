import CacheSlider from "./CacheSlider";
import { RUN, RATES, compactTokens, micros, price, usd } from "./usage";

const SRC = "https://github.com/superplanehq/superplane/blob/b01c19a";
const ISSUE = "https://github.com/superplanehq/superplane/issues/9049";

const before = {
  inputFull: RUN.input,
  total: RUN.input + RUN.cached + RUN.output,
  cost: price(RUN.input, RUN.cached, RUN.output),
};
const after = {
  inputFull: RUN.input - RUN.cached,
  total: RUN.input - RUN.cached + RUN.cached + RUN.output,
  cost: price(RUN.input - RUN.cached, RUN.cached, RUN.output),
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">{children}</p>;
}

function UsageCard({
  label,
  tone,
  data,
}: {
  label: string;
  tone: "bad" | "good";
  data: { inputFull: number; total: number; cost: number };
}) {
  const color = tone === "bad" ? "text-bad" : "text-good";
  const rows = [
    ["Input at full rate", data.inputFull, micros(data.inputFull, RATES.input)],
    ["Cache read", RUN.cached, micros(RUN.cached, RATES.cacheRead)],
    ["Output", RUN.output, micros(RUN.output, RATES.output)],
  ] as const;
  return (
    <div className="rounded-xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[15px]">Implement</span>
          <span className="rounded-full bg-[#2a2440] px-2 py-0.5 text-xs text-[#c9b8ff]">gpt-6-astra</span>
        </div>
        <span className={`font-mono text-[11px] uppercase tracking-wider ${color}`}>{label}</span>
      </div>
      <div className="flex items-baseline justify-between px-5 pt-4">
        <span className="font-mono text-2xl">{compactTokens(data.total)} tokens</span>
        <span className={`font-mono text-2xl ${color}`}>{usd(data.cost)}</span>
      </div>
      <table className="mt-3 w-full font-mono text-[13px]">
        <caption className="sr-only">{label} usage breakdown</caption>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
            <th scope="col" className="px-5 py-2 font-normal">Bucket</th>
            <th scope="col" className="px-2 py-2 text-right font-normal">Tokens</th>
            <th scope="col" className="px-5 py-2 text-right font-normal">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, tokens, cost]) => (
            <tr key={name} className="border-t border-line">
              <td className="px-5 py-2 text-muted">{name}</td>
              <td className="px-2 py-2 text-right">{tokens.toLocaleString("en-US")}</td>
              <td className="px-5 py-2 text-right">{usd(cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Page() {
  const factor = (before.cost / after.cost).toFixed(1);
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16 pt-14 sm:px-8">
      <header className="text-center">
        <Eyebrow>superplane #9049 · usage accounting</Eyebrow>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl leading-[1.1] sm:text-5xl">
          OpenAI cached input is counted twice.
          <span className="block text-[#9fb8b3]">Count it once, like text_prompt.go already does.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[17px] text-muted">
          <strong className="font-normal text-foreground">Problem:</strong> the Codex runner stores OpenAI&apos;s{" "}
          <code className="font-mono text-[15px]">cached_input_tokens</code> next to{" "}
          <code className="font-mono text-[15px]">input_tokens</code>, but it is part of it, so one 40-minute step is
          recorded at {usd(before.cost)} instead of {usd(after.cost)}.{" "}
          <strong className="font-normal text-foreground">Fix:</strong> subtract cached tokens from input at ingest.
          Anthropic usage is unchanged.
        </p>
      </header>

      <section aria-labelledby="cards" className="mt-12">
        <h2 id="cards" className="sr-only">
          Before and after
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          <UsageCard label="Recorded today" tone="bad" data={before} />
          <UsageCard label="With the fix" tone="good" data={after} />
        </div>
        <p className="mt-3 text-center text-sm text-muted">
          Numbers from a self-hosted run reported by{" "}
          <a className="underline decoration-line underline-offset-4 hover:text-foreground" href={ISSUE}>
            @mvgijssel in #9049
          </a>{" "}
          ({factor}× over). Recomputed with <code className="font-mono">pricebook.micros()</code>; the before total
          matches their recorded <code className="font-mono">cost_micros</code> exactly.
        </p>
      </section>

      <section aria-labelledby="why" className="mt-14 grid gap-8 md:grid-cols-[1.1fr_1fr]">
        <div>
          <Eyebrow>Why it matters before hosted credits launch</Eyebrow>
          <h2 id="why" className="mt-3 text-2xl">BYOK today it&apos;s a wrong number. On hosted credits it&apos;s a charge.</h2>
          <ul className="mt-4 space-y-3 text-[15px] text-muted">
            <li>
              <a className="text-foreground underline decoration-line underline-offset-4" href={`${SRC}/ee/billing/service.go#L158-L180`}>
                PriceUsage
              </a>{" "}
              prices usage with no provider cost through <code className="font-mono">EstimateMicros</code>, then applies
              the org markup when <code className="font-mono">funding_source=hosted</code>.
            </li>
            <li>
              Same overlap, not in the issue: the Go OpenAI client in{" "}
              <a className="text-foreground underline decoration-line underline-offset-4" href={`${SRC}/pkg/llm/openai_compat.go#L264-L280`}>
                pkg/llm/openai_compat.go
              </a>{" "}
              maps <code className="font-mono">prompt_tokens_details.cached_tokens</code> the same way. Direct OpenAI
              returns no cost, so that usage is estimated too (latent until hosted).
            </li>
            <li>
              The rule already exists in{" "}
              <a className="text-foreground underline decoration-line underline-offset-4" href={`${SRC}/pkg/integrations/openai/text_prompt.go#L450-L470`}>
                pkg/integrations/openai/text_prompt.go
              </a>{" "}
              (<code className="font-mono">input -= cached</code>). The fix applies it to the other two paths.
            </li>
          </ul>
        </div>
        <CacheSlider />
      </section>

      <section aria-labelledby="diff" className="mt-14">
        <Eyebrow>The change · 2 files + tests</Eyebrow>
        <h2 id="diff" className="mt-3 break-all text-xl sm:text-2xl">pkg/components/runner/codex/run.js</h2>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-line bg-panel p-5 font-mono text-[13px] leading-6">
          <code>
            <span className="text-muted">{"  const cacheRead = Number(source.cached_input_tokens || source.cache_read_input_tokens || 0);\n"}</span>
            <span className="text-muted">{"  let input = Number(source.input_tokens || source.prompt_tokens || 0);\n"}</span>
            <span className="text-good">{"+ // OpenAI reports cached_input_tokens as a subset of input_tokens (#9049).\n"}</span>
            <span className="text-good">{"+ if (source.cached_input_tokens != null && cacheRead > 0 && cacheRead <= input) {\n"}</span>
            <span className="text-good">{"+   input -= cacheRead;\n"}</span>
            <span className="text-good">{"+ }\n"}</span>
            <span className="text-muted">{"  const usage = { input_tokens: input, ... cache_read_input_tokens: cacheRead, ... };"}</span>
          </code>
        </pre>
        <ul className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-3">
          <li className="rounded-lg border border-line p-4">
            <span className="block font-mono text-[11px] uppercase tracking-wider text-accent">Also</span>
            Same rule in <code className="font-mono">openAIUsage.toUsage()</code> (Go).
          </li>
          <li className="rounded-lg border border-line p-4">
            <span className="block font-mono text-[11px] uppercase tracking-wider text-accent">Tests</span>
            #9049 numbers → input 780,777; Anthropic disjoint case unchanged. Written in your{" "}
            <code className="whitespace-nowrap font-mono">node -e</code> test style.
          </li>
          <li className="rounded-lg border border-line p-4">
            <span className="block font-mono text-[11px] uppercase tracking-wider text-accent">Existing rows</span>
            Read-only SELECT showing old vs recomputed cost per row. No UPDATE.
          </li>
        </ul>
        <p className="mt-5 text-sm text-muted">
          Patch, PR description and dry-run SQL:{" "}
          <a className="text-foreground underline decoration-line underline-offset-4" href="/fix.patch">fix.patch</a> ·{" "}
          <a className="text-foreground underline decoration-line underline-offset-4" href="/PR.md">PR.md</a> ·{" "}
          <a className="text-foreground underline decoration-line underline-offset-4" href="/backfill-dry-run.sql">backfill-dry-run.sql</a>
        </p>
      </section>

      <footer className="mt-20 border-t border-line pt-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted">
        Unofficial demo by Cheryl Aurelia: not affiliated with SuperPlane
      </footer>
    </main>
  );
}
