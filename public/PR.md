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
- `pkg/llm/openai_compat_usage_test.go` (new): #9049 numbers → `InputTokens` 780,777; provider total unchanged; no-cache case unchanged.
- `pkg/components/runner/codex/run_test.go` (new): `extractUsage` via `node -e`, same style as `thinkingArgsFromScript`; OpenAI subset case + Anthropic disjoint case.
- Two existing assertions encoded the overlap and are updated to the disjoint value:
  `TestFormatCodexJsonLinesEmitsCompletedUsage` (input 100 with 30 cached → 70) and
  `TestOpenAI_ListModelsAndComplete` (prompt_tokens 10 with 2 cached → 8). Totals are unchanged in both.
- Ran locally (Go 1.27.3, protos generated with `scripts/protoc.sh`): `go test ./pkg/llm/ ./pkg/components/runner/codex/ ./pkg/components/runner/openrouter/ ./ee/billing/pricebook/` passes, `gofmt -s -l` clean.
  The DB-backed tests (`TestSeedDevHostedOpenRouter*`) were skipped (no local Postgres); CI will run them.

## Worth a look
- OpenRouter also goes through `openAIUsage.toUsage`. Their usage follows the OpenAI schema (`cached_tokens` inside `prompt_tokens`) and they return `cost`, so pricing there uses the provider cost, not `EstimateMicros`. I didn't verify this against a live OpenRouter response.
- `input_tokens` in the Codex turn records and the run UI now means uncached input, the same as Anthropic. I found no context-window or compaction logic reading it, but the live-log dialog shows it as is.

## Not in this PR
- Existing rows: `backfill-dry-run.sql` is a read-only SELECT showing old vs. recomputed tokens/cost for estimate-priced OpenAI rows before the deploy. No UPDATE.
- Reasoning tokens are also a subset of output for OpenAI. Whether that affects cost depends on the catalog `internal_reasoning` rate, which I didn't verify. Left out.
- The UI vs DB discrepancy @mvgijssel saw (124.3M/$700 vs 112.1M/$629.90) is separate and not investigated here.
