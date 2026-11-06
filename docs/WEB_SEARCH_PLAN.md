# Optional web search and live-data tools — complete integration plan

Owner: Parth Verma. Last reviewed: November 6, 2026.
Status: **implemented and included in standalone 0.5.6 and Dev; native A54 release acceptance pending**. Owner authorized production parity on November 6. Existing provider/proxy setup and shared quotas remain unchanged. Historical Dev-pilot steps below describe rollout history, not current production gating.

## 1. Recommendation and decision

The product scope is **general internet questions**, not a stock-price feature: news, current events, products, technical documentation, travel, sports, public facts and other web information. Stocks are an example only. Use **Brave Search as the first general-search provider**, with a small provider-independent adapter. Keep **SerpApi as an alternative to evaluate**, not an automatic second provider. Specialized data APIs are optional later additions when a query needs precise structured live data; they are not prerequisites for shipping general search. Neither snippets nor answer boxes establish an authoritative live stock feed.

This recommendation is based on integration fit and published pricing, not a PhoneGPT relevance benchmark. Brave has its own index and offers extracted grounding content; SerpApi is attractive when Google-specific search results, local packs, shopping or other specialized SERP data are the actual requirement. Do not assume either provider is universally more accurate, faster, more private or cheaper per useful answer.

Before a public release, compare 30 representative English questions: Indian/global news, technical questions, local queries, ambiguous companies and time-sensitive questions. Compare source relevance, dates, answer support, end-to-end latency and cost per accepted answer. Use identical prompts/results budgets. Keep raw test data synthetic/public; do not upload customer histories for evaluation. A manual developer benchmark is enough; no analytics service is required.

## 2. Current provider facts and commercial checks

As checked November 6, 2026:

- Brave's Search plan lists **$5 per 1,000 requests** and **$5 monthly Search credits**. Its broader headline advertises up to $20 across products; do not use that headline as an unconditional Search allowance. The Search product includes web results and LLM-oriented context. Confirm eligibility, endpoint billing, storage rights and terms in the actual account before activation. [Pricing](https://brave.com/search/api/).
- SerpApi lists **250 searches/month free**, **$25/month for 1,000** and **$75/month for 5,000**. Google organic results and specialized SERP formats are available. A standard cached response can be up to an hour old; configure freshness intentionally. Its API documentation calls `zero_trace` Enterprise-only while pricing placement is less clear, so confirm availability rather than promising zero retention. [Pricing](https://serpapi.com/pricing), [API/caching/privacy parameters](https://serpapi.com/search-api).

Example budget arithmetic, not a purchase authorization: 1,000 uncached Brave Search requests have a $5 list cost before credits; 10,000 have a $50 list cost. Worker, market-data and any additional retrieval requests are separate. One answer may cost multiple requests if retries/expansion are enabled. Plan limits and quotas must be rechecked when implementing.

Use Brave **Search**, not its hosted **Answers** product: final answer generation should remain on the phone. LLM Context is retrieved page content, not a requirement to run our chat model remotely. [LLM Context](https://api-dashboard.search.brave.com/documentation/services/llm-context).

## 3. Stack and components

- Mobile: existing React Native/TypeScript, `fetch`, `AbortController`, existing local persistence and llama.rn. No LangChain, LangGraph, vector database, remote chat model or Python/FastAPI server is needed for this MVP.
- A separate Cloudflare Worker provides only a restricted data-fetching API. Keep it outside the static marketing website and its build. If implemented later, use a separate service repository consistent with the project's separate-repository preference.
- Worker runtime secrets: `BRAVE_SEARCH_API_KEY`, and optionally a market-data key. GitHub Actions Secrets hold deployment credentials; runtime provider keys belong in Worker secrets. Nothing secret enters `NEXT_PUBLIC_*`, Expo public config, bundled JS, model prompts or chat JSON. [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Brave authentication](https://api-dashboard.search.brave.com/documentation/guides/authentication).
- A small typed registry starts with `web_search`. `get_stock_quote`, weather, sports and similar structured tools are optional future adapters, not v1 requirements. Runtime JSON validation is required; TypeScript types alone do not validate external data. Hand-written bounded validators are enough; Zod is optional if it simplifies the separate Worker service.

## 4. Product behavior and privacy

Web defaults **on for new Dev preferences**, as requested by the owner on November 6. Preserve an explicit saved off choice. Show a compact Web button beside the model selector under the chat UUID. Show the online-query disclosure once in a dismissible informational popup, not as recurring composer text. An explicit per-message request to use web search authorizes search for that turn even if the saved toggle is off; an explicit request not to search stays local. Definitions and basic meanings remain local; officeholder questions (current or historical), prices, and specific facts favor verification. Production remains feature-gated off.

When enabled, show Searching… or Fetching latest quote… inline. Keep the draft editable. Existing Stop must cancel both network work and any subsequent local generation. Show source cards and retrieval/quote timestamps with the answer. Ordinary offline chat, attachments, history, Stop and voice behavior remain usable when Web is off.

Only the actual query/symbol and explicitly selected locale go out. Do not send the entire conversation, system prompt, TXT contents or microphone recording. Contextual follow-ups such as “and Apple?” can use local history to form the minimal query; if this would disclose a private identifier or context, show/edit the query or ask before sending. Do not request GPS for v1. English is the initial language; use a configurable country such as India without claiming the user is physically there.

The proxy/provider sees query content and request metadata. Do not promise all data stays on device while Web is enabled. Avoid raw query/request-body logs, define infrastructure retention, disable unnecessary debugging, and update app/site privacy and store disclosures before shipping. Result caching is off initially, avoiding shared sensitive-query storage. Later cache only provider-permitted non-sensitive queries with explicit TTL/provenance.

## 5. General-search request and response

Proposed app-to-Worker route: `POST /v1/search` with a bounded body containing `query`, optional `country`, optional `freshness` and a requested result limit of at most 3. Do not include chat UUIDs, filenames or full messages by default. Reject unknown properties and very large/empty queries.

The Worker chooses a configured provider, calls only its fixed HTTPS API endpoint, normalizes the response and returns:

- request ID unrelated to local chat ID;
- provider and retrieval time;
- results with stable local source ID, title, HTTPS URL, domain, text excerpt and publication/fetch times when actually supplied;
- indication that the content is a search snippet versus extracted page text;
- optional explicit partial/truncated status.

Proposed initial transport limits: query <=500 characters, request body <=8 KB, response <=64 KB, up to 3 normalized sources and a 15-second deadline. These are project defaults to tune, not provider guarantees. Respect upstream limits if stricter.

Start with Brave Web Search snippets to prove the UI and grounding loop. For questions snippets cannot support, test Brave LLM Context behind the same adapter; fetch relevant extracted content without adding a crawler/Firecrawl/browser service. Do not call both endpoints by default. If full text is needed but unavailable, say the sources are insufficient rather than inventing a supported answer. [Web API](https://api-dashboard.search.brave.com/api-reference/web/search/get), [LLM Context](https://api-dashboard.search.brave.com/documentation/services/llm-context).

SerpApi adaptation later uses the same normalized response. No automatic provider failover: that changes data recipients and cost; enable only after explicit configuration/disclosure. Do not put provider-specific fields in UI components.

## 6. Optional specialized data — stocks as an example

After general search is working, an optional `POST /v1/quote` could accept a validated symbol plus exchange. Do not add or require this route in the initial search release. Candidate: Twelve Data, subject to market coverage and public-display/redistribution entitlement checks. Keep the adapter replaceable. NVIDIA -> NVDA and Apple -> AAPL are straightforward examples, but resolve ambiguous instruments/exchanges rather than guessing; Indian exchange support needs separate verification. No market-data plan has been selected or purchased.

Return exact provider price as a decimal string, currency, canonical symbol, exchange, provider quote time, retrieval time, market session and real-time/delayed/last-close label **when available**. Unknown delay or session stays unknown. A retrieval timestamp is not the trade timestamp. Market-closed/after-hours values need clear labels.

Render this record directly in a quote card before optional local-model explanation, so a small model cannot silently rewrite digits. Search may provide supporting news, but cannot replace the quote provider on failure. Do not promise executable trading prices or real-time coverage without entitlement evidence. A historical quote in chat must never be treated as a fresh quote. [Provider endpoint reference](https://github.com/twelvedata/twelvedata-node/blob/master/api_reference.md), [commercial plans](https://twelvedata.com/pricing-business).

## 7. Local model grounding and context budget

Current ChatMessage supports only user/assistant roles. Existing llama.rn supports tools, tool_choice and parsed tool_calls, but PhoneGPT does not yet execute the loop. First add app-managed retrieval: the user enables Web, the app performs the lookup, and the loaded model explains normalized evidence. This works without relying on the smallest model to pick valid functions.

Reserve system prompt, current question, recent chat and requested reply space before adding evidence. At the default 2048-token context, target a compact evidence budget around 400–600 tokens only when it fits; use the model tokenizer to calculate the real remaining space, rather than assuming this allowance always exists. Reduce sources/excerpts or display sources without a generated summary when there is no safe budget. Never silently increase context/RAM.

Evidence is clearly delimited untrusted data. Instruct the model to use it for factual support, ignore instructions embedded in it and admit missing/conflicting evidence. Label citations [1], [2], [3]; link them through the app's actual source mapping, not arbitrary model-produced URLs. Validate that cited IDs exist. This prevents fabricated links but does not prove every claim is entailed: test factual grounding and avoid asserting certainty from the presence of a citation alone.

Recompute token counts, preserve normal history and streaming, and guard against responses updating a different chat after navigation. Store source/provenance with the resulting message and keep it marked historical on later turns. Full retrieved documents are not automatically duplicated into permanent chat storage.

## 8. Optional model-driven tool loop — later phase

Add schema-defined web_search only for exact models/templates that pass device tests; specialized tools can be added independently later. Validate names/arguments and do not dispatch text that merely resembles JSON. Support explicit tool-call IDs/tool-result roles only where the model template supports them; use app-managed evidence for other models. A structured JSON dispatch mode is an optional fallback, not shell/network access.

Maximum proposed automatic budget: 2 tool calls per user turn, sequential execution, no recursion/unbounded “research.” Generated queries remain subject to the same privacy, length and endpoint rules. Start with one call; never enable extra paid calls by default without a budget decision. On malformed calls, either one local correction attempt or an explanatory failure, not an endless loop.

## 9. Failure/cancellation state machine

`idle -> retrieving -> validating -> generating -> complete`, with explicit cancelled/error terminals. Use a per-turn ID and cancellation signal. Ignore late results after Stop, chat switch, deletion or unmount. Do not treat provider failure as a successful web-assisted answer.

Handle offline, denied credentials, 429/quota, timeout, malformed JSON, empty results, stale/contradictory sources and ambiguous stock symbols. At most one bounded retry for transient failures, honoring Retry-After and remaining call/cost budget; no retries for invalid credentials/arguments. An unknown timeout outcome may already have incurred provider cost. Always retain the user's question/draft and show useful error text. Without verified fresh quote data, show inability to fetch it rather than a model guess.

## 10. Proxy access, cost controls and deployment

A hidden upstream key does not make an unauthenticated proxy abuse-proof. CORS is not authentication, and an embedded shared mobile app secret can be extracted. For a Dev pilot, restrict access to approved testers with short-lived revocable access and a hard global request allowance. Production access/abuse controls need a separate decision before public release; user accounts remain optional and are not introduced by this plan.

Use per-IP throttles and per-install hints as soft controls, not trusted identity. Keep an atomic global quota counter/kill switch in a Durable Object or equivalent strongly consistent control, not eventually consistent KV as the only budget authority. Counters need no raw query storage. Proposed pilot ceiling: 1,000 upstream search requests/month and one in-flight request per device session; choose the actual spending cap before activation. A provider limit may be stricter. Account quotas must include retries and all enabled endpoints.

Keep test/prod Worker secrets and endpoints separate. Use a Worker-specific scoped deployment credential; the existing website Pages-only token does not grant Worker deployment permission. No need to broaden it. CI tests/builds run before deployment and should not require live provider keys; real integration tests are explicit controlled runs. Do not automatically deploy to the marketing website's Pages project.

## 11. Files and contracts to implement later

Proposed mobile additions: `src/services/webTools.ts` for tool contracts/adapters; `src/services/webGrounding.ts` for evidence/token/citation handling; `src/hooks/useWebLookup.ts` for cancellation/state; small Web toggle and source/quote card components. Extend inference/message/storage types deliberately, with backward-compatible optional metadata so existing local chats still load. Adapt names to existing conventions during implementation.

Proposed separate Worker service: routes, provider adapters, validators, quota control, secret bindings, tests and deployment configuration. No MongoDB, chat sync, embeddings or vector store in v1. Update both living specifications, tracker, release notes, privacy and customer copy with the implemented behavior. Do not advertise the planned feature as available.

## 12. Verification and rollout gates

Phase A — provider/account decision and plan review: compare real query quality using synthetic data; confirm pricing/retention/content rights and stock-feed terms; choose a pilot budget/access approach. No credentials in chat or source.

Phase B — mocked vertical slice: Web toggle -> fake normalized results -> local evidence -> citations/quote cards. Test context overflow, no-model case, malformed input, unknown citations, prompt injection, mixed search/source markup, long filenames/private attachments, currency decimals, stale quotes, navigation/Stop races and old chat migration.

Phase C — restricted Worker integration: secret provisioning, real Brave lookups across general web topics, error/quota handling and network payload inspection. Verify the only outbound content is the intended query/symbol; inspect logs and published bundles for secrets.

Phase D — A54 Dev test: loaded-model summaries, English voice query -> editable text -> optional lookup, time to first answer, RAM/context impact, offline fallback, return to ordinary local chat and no accidental requests when Web is off. Compare app-managed and model-driven modes separately; unsupported models retain app-managed mode.

Phase E — matched standalone build: same code/settings as tested Dev, package/source verification and physical APK checks, privacy/store updates and release notes. Publish only after explicit device verification/authorization. Native/dependency changes require rebuilt Dev too; JavaScript changes reach an already compatible Dev via Metro, but Prod needs a new APK.

Success means the opt-in path fetches/grounds answers, sources, freshness labels and citations are accurate, no credentials/unrelated chat data leave the intended boundaries, cancellation and offline chat work, calls stay within budget and the actual standalone installation passes device testing. No accuracy percentage or guaranteed latency is promised before measurements.

## 13. Non-goals and implementation status

No remote LLM inference, autonomous browsing, arbitrary webpage fetches, trading, image search, deep research agents, mandatory login or persistent conversation backend in the first version. This plan has not changed app behavior, created accounts, deployed services, retrieved live quotes or enabled billing.

## Dev pilot deployment — November 6, 2026

Owner approved Worker deployment access and a capped app-accessible endpoint. Deployed `phone-gpt-search` at `https://phone-gpt-search.tensor0712.workers.dev` with its SQLite-backed quota binding; runtime flags are true for this pilot, while checked-in defaults remain false. `RATE_LIMIT_SALT` is provisioned as an encrypted runtime secret. Before the owner adds `BRAVE_SEARCH_API_KEY`, POST correctly returns 503 without calling Brave. The app Dev server runs on port 8083 with the public endpoint and feature flag in ignored `.env.local`; `__DEV__` also gates the feature, keeping production off. No new native dependency or Dev APK is required for this JS update. End-to-end provider and device checks are pending key entry. The Cloudflare dashboard calls this Worker's default environment “Production”; it is nevertheless the Dev search pilot, separate from the mobile production rollout and marketing Pages project.

Live verification: the owner saved the Brave key as an encrypted Worker secret. One synthetic public query (`latest astronomy news`) returned HTTP 200 with three sources. The key value was not read. This proves the deployed proxy/provider path; local routing, grounded generation and citations still require an A54 end-to-end test.

Dev UX follow-up: search now has an app-owned nonblocking overlay, grounded answers an app-owned prefix, and prompt wording avoids boilerplate trailing disclaimers. Context usage includes the current web prompt/evidence/reply and persists a scoped last-turn snapshot. Counts remain approximate with native template overhead; streaming output is estimated, completed output tokenized. Aggregate Worker metrics are available; no user identity or query/chat logs are collected by application code. Detailed platform logs/traces remain off. Device verification pending for this follow-up.
