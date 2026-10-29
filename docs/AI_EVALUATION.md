# CARES AI evaluation

Executed 2026-10-29. Full machine-readable evidence: `ml/evaluation.json`, `ml/parity.json`, `evaluation/ai-cases.json`, `evaluation/offline-results.json`.

## Dataset decision and provenance

Reviewed [MedQuAD's original repository](https://github.com/abachaa/MedQuAD), accessed 2026-10-29. Its CC BY 4.0 question-answer collection has question-type and entity annotations, rather than validated CARES specialty-navigation labels. It was not relabeled by guessing specialties and was not downloaded or used for training. Its authors also document copyright-related answer exclusions. Broader medically valid symptom-to-specialty training requires licensed, clinically reviewed labels and separate approval.

The implemented fallback is repository-authored synthetic dataset `navigation-synthetic-v1`, under the repository ISC license. It contains **80 examples**, five explicit service-intent classes with **16 examples each**: Cardiology, Dermatology, General Medicine, Orthopedics, Pediatrics. It contains no real patient descriptions. Labels reflect the named specialty, not clinical interpretation of symptoms. Spelling, ontology and clinical review limitations are material.

Preprocessing: lowercase alphabetic word tokens of at least two letters, unigram TF-IDF, ordinary term counts, inverse-document frequency learned on training data only, L2 normalization. Exact normalized duplicates are rejected. Near-duplicate paraphrases share template group IDs; each template group across all specialties stays wholly within one split. There is still common author and domain vocabulary across groups, so these metrics are optimistic and cannot establish generalization. Counts are balanced; the model uses balanced class weights. Seed: 42.

Fixed split: **50 train, 15 validation, 15 final test**. Five regularization values (0.5, 1, 2, 4, 8) were selected using validation macro-F1, choosing the smaller C on ties. Selected C: **0.5**. The final classifier refits training plus validation using the training vocabulary and then evaluates the untouched test groups. Abstention thresholds are derived from the original training-model validation probabilities and are uncalibrated; an explicit-intent safety guard is also required.

## Measured held-out comparison

| Model | Accuracy | Macro-F1 | Median batch-one model prediction, ms | Parameter bytes |
|---|---:|---:|---:|---:|
| TF-IDF + logistic regression | 0.666667 | 0.667619 | 0.082250 | 2400 |
| TF-IDF + two-hidden-layer MLP | 0.666667 | 0.670000 | 0.073479 | 10536 |

The neural experiment has hidden layers [16, 16]; hidden size was selected on validation, with the identical 15-example held-out set. It is a small neural experiment, not transformer fine tuning. The 0.002381 macro-F1 difference on 15 examples is not evidence of reliable superiority. Logistic regression was selected for a small portable artifact and simple inference. JSON artifact: **8523 bytes**. Peak training/evaluation process RSS was **128450560 bytes**, covering both models and libraries; this is not serving memory. Timings exclude text vectorization, requests, cold starts, database lookup and platform effects. No cloud serving costs were measured.

| Class | Baseline precision | Recall | F1 | Test support |
|---|---:|---:|---:|---:|
| Cardiology | 1.0000 | 0.6667 | 0.8000 | 3 |
| Dermatology | 1.0000 | 0.6667 | 0.8000 | 3 |
| General Medicine | 0.5000 | 1.0000 | 0.6667 | 3 |
| Orthopedics | 1.0000 | 0.3333 | 0.5000 | 3 |
| Pediatrics | 0.5000 | 0.6667 | 0.5714 | 3 |

Confusion matrix, actual rows and predicted columns in this order: Cardiology, Dermatology, General Medicine, Orthopedics, Pediatrics.

```json
[[2, 0, 1, 0, 0], [0, 2, 0, 0, 1], [0, 0, 3, 0, 0], [0, 0, 1, 1, 1], [0, 0, 1, 0, 2]]
```

Error analysis is saved per example in `ml/evaluation.json`: unseen specialty synonyms and shared words such as “medicine” were confused. There is no symptom, multilingual, child-safety or clinical outcome validation. Runtime guards deliberately abstain for symptoms and ambiguous intents. Node inference probability parity was checked against scikit-learn on all 15 held-out examples to tolerance 1e-10. Separate smoke/guard cases passed 12/12; they overlap basic training vocabulary and are not additional held-out accuracy evidence.

## RAG corpus and measured offline results

Corpus: six factual/service-document summaries with source titles, URLs, versions, access date, permission rationale and stable paragraph IDs. It is an educational navigation corpus, not a clinical knowledge base. Short government factual paraphrases preserve attribution without claiming open licensing or source endorsement. CARES passages are repository-authored. Index rebuild is deterministic and each vector chunk maps to its original source paragraph. Rebuild: `npm --prefix backend run knowledge:build`.

| Measurement | Actual result | Scope |
|---|---:|---|
| Retrieval recall@3 | 1.0000 (12/12) | Small repository-authored query set |
| Retrieval top-1 accuracy | 1.0000 (12/12) | One expected source per query |
| Mean local retrieval latency | 0.0534 ms | Warm local process; not cloud latency |
| Emergency / refusal / privacy / unsupported checks | 10/10 | Ten English keyword/abstention cases |
| Citation transport/ID contract | Automated test passed | Mocked provider output, not live quality |
| Live answer groundedness, usefulness, abstention quality | **Not measured** | Credential and budget approval absent |
| Live citation correctness, generation latency, failure rate | **Not measured** | Real provider requests not executed |
| Actual LLM operating cost | **Not measured** | No billable requests executed |

Answerable, unsupported, incorrect-premise, missing-source, emergency, injection and privacy cases are in `evaluation/ai-cases.json` and `backend/test/ai.test.js`. Actual doctor/hospital/department/private-appointment query checks are in SQLite/PostgreSQL integration tests. Input IDs/roles are never used to expand access. Source-ID validation does not prove faithfulness; live evaluation must score every material claim against returned excerpts.

## Live evaluation gate

Owner must configure the selected provider privately: `LLM_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`, or the existing Anthropic key/model with `LLM_PROVIDER=anthropic`. Authorize live evaluation and confirm free-tier eligibility/quotas; paid accounts additionally require budget approval. Run the saved question set on staging only. Save model ID, date, corpus hash, tokens and timings, inspect each citation and label every claim supported/unsupported. Record human usefulness (1–5), appropriate abstention counts, unsupported claims, HTTP/timeouts and actual provider billing. Do not label the mocked tests as live accuracy. No automatic judge score is substituted for clinical review.

Cost estimate formula: input tokens × provider input rate + output tokens × output rate; measure token usage from real responses. Calls time out after 15 seconds; Gemini caps generated tokens at 1,024 and Anthropic caps output at 700. Gemini usage includes reported candidate plus thought tokens in `outputTokens`. Exact token prices and Vercel/Neon plan charges must be checked with owner-selected services before enabling billing. Local lexical embeddings and bundled inference require no separate paid model endpoint or embedding key.

Reproduce with Python 3.15.1 / scikit-learn 1.9.1 (see `ml/requirements.txt`), `python ml/train.py`, `node backend/src/scripts/evaluateAI.js`, and backend tests. Results must be regenerated if the dataset, split, vocabulary, thresholds, corpus or model changes.

## Additional local inference benchmark

`node backend/src/scripts/benchmarkInference.js` measured 1,000 warm calls including safety guards, TF-IDF vectorization and inference, and five cold Node process launches. Results in `evaluation/inference-benchmark.json`: warm median 0.001958 ms; p95 0.005917 ms; cold process median 30.375 ms. Process RSS: 54870016 bytes. These are local macOS arm64 process measurements, not Vercel cold starts or full HTTP/database latency.

Follow-up context is bounded to six API history messages; the UI sends at most two prior navigation turns. History stays in page memory. Apparent identifiers and prior unsafe user prompts are blocked before provider calls. This heuristic does not establish complete PII or prompt-injection prevention.

The guarded live evaluator is `node backend/src/scripts/evaluateLiveNavigator.js --authorize-live-evaluation`. Without an authorization flag it exits before any provider call; refusal is tested separately from generation. With an owner-configured key/model and explicit budget approval it saves timestamped results, usage/timings and null human-review scores. It has not been run with billing authorization.

## Gemini transport validation

Gemini support uses the same retrieved context and citation allowlist. Six mocked transport tests cover provider selection/backward compatibility; request headers/schema/context; blocked/truncated/malformed/hallucinated citations; thought-text exclusion and follow-up context; 429/provider errors with no fallback; and timeout/missing-key/emergency paths. These are contract tests, not Gemini answer-quality scores. Existing CareMatch training metrics and the source corpus are unchanged. Offline retrieval remains 12/12 top-1 and recall@3; ten safety and twelve CareMatch smoke cases pass. No Gemini key is locally configured and no live answer quality, latency, failure-rate or cost measurement is claimed.
