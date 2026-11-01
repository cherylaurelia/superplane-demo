# SuperPlane #9049: OpenAI cached input counted twice (unofficial demo)

Unofficial demo by Cheryl Aurelia: not affiliated with SuperPlane.

## The problem
OpenAI reports cached input tokens as a **subset** of input tokens. SuperPlane's Codex runner and the
`pkg/llm` OpenAI-compatible client store them as a **separate** bucket, so token totals and
`EstimateMicros` count cached input twice.

- Reported by @mvgijssel: one 40-minute Codex Implement step recorded 112.1M tokens / $629.73; the
  correct cost is ~$74.49 (8.5× over). https://github.com/superplanehq/superplane/issues/9049
- Codex mapping: `pkg/components/runner/codex/run.js` (`extractUsage`), summed in
  `pkg/components/runner/turn_telemetry.js`, priced in
  https://github.com/superplanehq/superplane/blob/b01c19a/ee/billing/pricebook/pricebook.go#L259-L269
- On `funding_source=hosted`, `PriceUsage` applies the org markup to that estimate, so it becomes a
  real charge: https://github.com/superplanehq/superplane/blob/b01c19a/ee/billing/service.go#L158-L180
- Same overlap in the Go client (not in the issue):
  https://github.com/superplanehq/superplane/blob/b01c19a/pkg/llm/openai_compat.go#L264-L280
- The right rule already exists in their OpenAI integration (`input -= cached`):
  https://github.com/superplanehq/superplane/blob/b01c19a/pkg/integrations/openai/text_prompt.go#L450-L470

## What's here
- `public/fix.patch`: `git am`-able patch against superplane `e1bd6e22d` (Codex `extractUsage` +
  `openAIUsage.toUsage`, plus tests). Anthropic usage is unchanged.
- `public/PR.md`: PR description crediting #9049, with the math.
- `public/backfill-dry-run.sql`: read-only SELECT of old vs recomputed cost for existing rows. No UPDATE.
- The page: the #9049 run as a before/after usage card (recomputed with the same `micros()` formula,
  the "before" matches the recorded `cost_micros` exactly) and a slider showing how the overcharge
  grows with cache hit rate.

Go tests for the touched packages pass locally (`go test ./pkg/llm/ ./pkg/components/runner/codex/ ./ee/billing/pricebook/`; DB-backed seed tests skipped, no local Postgres).

## Run
```bash
npm install
npm run build && npm run start   # http://localhost:3000
```
