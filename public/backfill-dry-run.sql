-- DRY RUN: read-only. Shows how much each estimate-priced OpenAI usage row was
-- over-counted by the cached-input double count (#9049). No UPDATE here.
-- Set :fix_deployed_at to when the fix shipped; rows after it are already correct.
-- Only rows priced from the price book (not '+provider' / '+subscription').
WITH candidate AS (
  SELECT e.*
  FROM workspace_usage_events e
  WHERE e.usage_kind = 'model'
    AND e.provider = 'openai'
    AND e.cache_read_tokens > 0
    AND e.price_book_version NOT LIKE '%+provider'
    AND e.price_book_version NOT LIKE '%+subscription'
    AND e.created_at < :'fix_deployed_at'
),
rated AS (
  SELECT DISTINCT ON (c.id)
         c.id, c.organization_id, c.funding_source, c.model, c.created_at,
         c.input_tokens, c.cache_read_tokens, c.total_tokens,
         c.provider_cost_micros, c.cost_micros,
         r.input_cents_per_million
  FROM candidate c
  JOIN usage_price_book_rates r
    ON r.usage_kind = 'model'
   AND r.version = split_part(c.price_book_version, '+', 1)
   AND (r.provider = '' OR r.provider = c.provider)
   AND (  (r.match_mode = 'exact'  AND c.model = r.match_key)
       OR (r.match_mode <> 'exact' AND c.model LIKE r.match_key || '%'))
  ORDER BY c.id, (r.match_mode = 'exact') DESC, length(r.match_key) DESC
)
SELECT id, organization_id, funding_source, model, created_at,
       total_tokens                                              AS old_total_tokens,
       total_tokens - LEAST(cache_read_tokens, input_tokens)     AS new_total_tokens,
       provider_cost_micros                                      AS old_provider_cost_micros,
       provider_cost_micros
         - LEAST(cache_read_tokens, input_tokens) * input_cents_per_million * 10000 / 1000000
                                                                 AS new_provider_cost_micros,
       cost_micros                                               AS old_cost_micros,
       -- billed cost scales with provider cost (markup is a ratio)
       CASE WHEN provider_cost_micros > 0 THEN
         cost_micros * (provider_cost_micros
           - LEAST(cache_read_tokens, input_tokens) * input_cents_per_million * 10000 / 1000000)
           / provider_cost_micros
       ELSE cost_micros END                                      AS new_cost_micros
FROM rated
ORDER BY (provider_cost_micros
          - LEAST(cache_read_tokens, input_tokens) * input_cents_per_million * 10000 / 1000000)
         - provider_cost_micros ASC;
