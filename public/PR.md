# fix: don't count OpenAI cached input tokens twice (#9049)

Fixes #9049, reported by @mvgijssel, who did the diagnosis and the arithmetic. This PR implements the fix they proposed (normalize at ingest) and covers two related paths.

## What changes
- **Codex runner** (`pkg/components/runner/codex/run.js`, `extractUsage`): when the event has OpenAI's `cached_input_tokens`, subtract it from `input_tokens` so the buckets don't overlap. Anthropic-style `cache_read_input_tokens` is already disjoint and is left alone.
- **`pkg/llm` OpenAI-compatible client** (`openAIUsage.toUsage`): same rule for `prompt_tokens_details.cached_tokens`. Direct OpenAI returns no `cost`, so this usage is priced by `EstimateMicros`. That only becomes a charge on `funding_source=hosted`.
- Both now follow the rule `pkg/integrations/openai/text_prompt.go` already uses (`input -= cached`).

## Why now
`PriceUsage` (`ee/billing/service.go`) prices usage without a provider cost through `EstimateMicros`, then applies the org markup for hosted funding. With the overlap, hosted OpenAI runs would be billed for cached input at the full input rate plus the cache-read rate.

## Numbers (from #9049, `gpt-6-astra` @ 2026-09-23.1: input 1000, output 5000, cache_read 100 c/M)
| | input billed at full rate | cost (`micros()` formula) |
|---|---|---|
| before | 56,305,375 | 629,732,798 µ$ = **$629.73** (matches the recorded `cost_micros`) |
| after | 780,777 | 74,486,818 µ$ = **$74.49** |

## Tests
- `pkg/llm/openai_compat_usage_test.go`: #9049 numbers → `InputTokens` 780,777; provider total unchanged.
- `pkg/components/runner/codex/run_test.go`: `extractUsage` via `node -e`, same style as `thinkingArgsFromScript`; OpenAI subset case + Anthropic disjoint case.
- Ran the JS assertions locally with Node 26. **Go tests not run locally** (no Go toolchain on this machine); CI will run them.

## Not in this PR
- Existing rows: `backfill-dry-run.sql` is a read-only SELECT showing old vs. recomputed tokens/cost for estimate-priced OpenAI rows before the deploy. No UPDATE.
- Reasoning tokens are also a subset of output for OpenAI. Whether that affects cost depends on the catalog `internal_reasoning` rate, which I didn't verify. Left out.
- The UI vs DB discrepancy @mvgijssel saw (124.3M/$700 vs 112.1M/$629.90) is separate and not investigated here.
