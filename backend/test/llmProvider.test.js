import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLLMConfig, requestCompletion } from '../src/ai/llmProvider.js';
import { generate, navigate } from '../src/ai/navigator.js';
import { retrieve } from '../src/ai/retrieval.js';

const answer = { answer: 'An enquiry is not a confirmed booking. [cares-home-1]', citations: ['cares-home-1'], abstain: false };
const geminiResponse = (value = answer, extra = {}) => ({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }],
  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30, thoughtsTokenCount: 5 },
  ...extra,
});
const fake = result => async () => ({ ok: true, status: 200, json: async () => result });
const settings = { provider: 'gemini', key: 'synthetic-test-key', model: 'gemini-3.5-flash-lite' };

test('provider selection preserves Anthropic compatibility and chooses Gemini explicitly or by key presence', () => {
  assert.equal(resolveLLMConfig({}).provider, 'anthropic');
  assert.deepEqual(resolveLLMConfig({ GEMINI_API_KEY: 'synthetic', GEMINI_MODEL: settings.model }), { provider: 'gemini', key: 'synthetic', model: settings.model });
  assert.equal(resolveLLMConfig({ LLM_PROVIDER: 'anthropic', GEMINI_API_KEY: 'synthetic', ANTHROPIC_API_KEY: 'other-synthetic' }).provider, 'anthropic');
  assert.equal(resolveLLMConfig({ GEMINI_API_KEY: 'synthetic' }, { key: '' }).key, '');
  assert.throws(() => resolveLLMConfig({ LLM_PROVIDER: 'unknown' }), error => error.code === 'LLM_CONFIGURATION');
  assert.throws(() => resolveLLMConfig({}, { provider: 'gemini', model: '../../?key=private' }), error => error.code === 'LLM_CONFIGURATION');
});

test('Gemini transport uses header authentication, bounded JSON output and retrieved context; mocked provider', async () => {
  let calls = 0;
  const result = await generate({ ...settings, question: 'Home care enquiry', passages: retrieve('home care enquiry'), fetcher: async (url, options) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
    assert.ok(!url.includes(settings.key));
    assert.equal(options.headers['x-goog-api-key'], settings.key);
    assert.equal(options.headers['x-api-key'], undefined);
    assert.ok(options.signal);
    const body = JSON.parse(options.body);
    assert.match(body.systemInstruction.parts[0].text, /Never diagnose/);
    assert.match(body.contents[0].parts[0].text, /cares-home-1/);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.maxOutputTokens, 1024);
    assert.deepEqual(body.generationConfig.responseJsonSchema.required, ['answer', 'citations', 'abstain']);
    assert.equal(body.tools, undefined);
    return fake(geminiResponse())();
  } });
  assert.equal(calls, 1);
  assert.equal(result.status, 'answered');
  assert.equal(result.citations[0].url, '/home-care');
  assert.deepEqual(result.usage, { inputTokens: 120, outputTokens: 35, thoughtTokens: 5 });
});

test('Gemini rejects blocked, incomplete, malformed and invented citations using the existing evidence validator', async () => {
  const options = { ...settings, question: 'Home care enquiry', passages: retrieve('home care enquiry') };
  const bad = [
    null, {}, geminiResponse(null), geminiResponse([]), geminiResponse(42),
    geminiResponse(answer, { candidates: [{ finishReason: 'STOP', content: { parts: 'invalid' } }] }),
    geminiResponse(answer, { promptFeedback: { blockReason: 'SAFETY' } }),
    geminiResponse(answer, { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(answer) }] } }] }),
    geminiResponse(answer, { candidates: [] }),
    geminiResponse({ ...answer, answer: 'Claim [fake-source]', citations: ['fake-source'] }),
    geminiResponse(answer, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not-json' }] } }] }),
  ];
  for (const response of bad) assert.equal((await generate({ ...options, fetcher: fake(response) })).status, 'abstained');
});

test('Gemini excludes thought text from the answer and retains bounded follow-up context', async () => {
  let sent;
  const response = geminiResponse();
  response.candidates[0].content.parts.unshift({ thought: true, text: 'Internal non-answer text' });
  const result = await navigate('Is it confirmed?', { ...settings, history: [{ role: 'user', content: 'Tell me about Care at Home' }], fetcher: async (url, options) => {
    sent = JSON.parse(options.body);
    return fake(response)();
  } });
  assert.equal(result.status, 'answered');
  assert.ok(!result.answer.includes('Internal'));
  assert.match(sent.contents[0].parts[0].text, /Tell me about Care at Home/);
});

test('Gemini quota failures remain 429 with one request and no provider fallback or raw secret-bearing errors', async () => {
  let calls = 0;
  await assert.rejects(() => requestCompletion({ ...settings, system: 'test', context: {}, fetcher: async () => {
    calls++;
    return { ok: false, status: 429, json: () => { throw new Error('must not read private provider body'); } };
  } }), error => error.status === 429 && error.code === 'LLM_RATE_LIMITED' && !error.message.includes(settings.key));
  assert.equal(calls, 1);
  for (const status of [400, 401, 403, 404, 500, 503]) {
    await assert.rejects(() => requestCompletion({ ...settings, system: 'test', context: {}, fetcher: async () => ({ ok: false, status }) }), error => error.status === 503 && error.code === 'LLM_UNAVAILABLE');
  }
  await assert.rejects(() => requestCompletion({ ...settings, system: 'test', context: {}, fetcher: async () => { throw new Error(`upstream ${settings.key}`); } }), error => !error.message.includes(settings.key) && error.status === 503);
});

test('Gemini timeout reaches the existing API timeout handler and missing keys never call the provider', async () => {
  let calls = 0;
  assert.equal((await generate({ ...settings, key: '', question: 'Home care', passages: retrieve('home care'), fetcher: async () => { calls++; } })).status, 'unavailable');
  assert.equal(calls, 0);
  const timeout = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
  await assert.rejects(() => requestCompletion({ ...settings, system: 'test', context: {}, fetcher: async () => { throw timeout; } }), error => error.name === 'TimeoutError');
  const emergency = await navigate('I have chest pain', { ...settings, fetcher: async () => { calls++; } });
  assert.equal(emergency.status, 'emergency');
  assert.equal(calls, 0);
});
