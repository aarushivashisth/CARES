// Backend-only provider transport. Keys are sent in headers, never URLs or logs.
// No automatic provider fallback/retries: a free-tier quota error stays an error.
export function resolveLLMConfig(env = process.env, overrides = {}) {
  const provider = overrides.provider ?? env.LLM_PROVIDER ?? (env.GEMINI_API_KEY ? 'gemini' : 'anthropic');
  if (!['gemini', 'anthropic'].includes(provider)) {
    throw Object.assign(new Error('Unsupported LLM_PROVIDER. Choose gemini or anthropic.'), { status: 503, code: 'LLM_CONFIGURATION' });
  }
  const key = overrides.key ?? (provider === 'gemini' ? env.GEMINI_API_KEY : env.ANTHROPIC_API_KEY);
  const model = overrides.model ?? (provider === 'gemini' ? env.GEMINI_MODEL : env.ANTHROPIC_MODEL);
  if (model && (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(model))) {
    throw Object.assign(new Error('Invalid backend model configuration.'), { status: 503, code: 'LLM_CONFIGURATION' });
  }
  return { provider, key, model };
}

const responseSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    citations: { type: 'array', items: { type: 'string' } },
    abstain: { type: 'boolean' },
  },
  required: ['answer', 'citations', 'abstain'],
  additionalProperties: false,
};
const tokenCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

export async function requestCompletion({ provider, key, model, system, context, fetcher = fetch }) {
  const gemini = provider === 'gemini';
  const url = gemini
    ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    : 'https://api.anthropic.com/v1/messages';
  const body = gemini ? {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: responseSchema, maxOutputTokens: 1024 },
  } : {
    model, max_tokens: 700, system,
    messages: [{ role: 'user', content: JSON.stringify(context) }],
  };
  let result;
  try {
    const response = await fetcher(url, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: gemini
        ? { 'content-type': 'application/json', 'x-goog-api-key': key }
        : { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2026-10-21' },
      body: JSON.stringify(body),
    });
    if (response.status === 429) {
      throw Object.assign(new Error('The AI service quota or rate limit has been reached. Try again later.'), { status: 429, code: 'LLM_RATE_LIMITED' });
    }
    if (!response.ok) throw new Error('Provider unavailable');
    result = await response.json();
  } catch (error) {
    if (['TimeoutError', 'AbortError'].includes(error.name) || error.code === 'LLM_RATE_LIMITED') throw error;
    // Provider error bodies and raw transport errors can contain private metadata.
    throw Object.assign(new Error('The language model is temporarily unavailable.'), { status: 503, code: 'LLM_UNAVAILABLE' });
  }
  if (!result || typeof result !== 'object') return { text: '', blocked: true, usage: { inputTokens: 0, outputTokens: 0 } };
  if (gemini) {
    const candidate = Array.isArray(result.candidates) ? result.candidates[0] : undefined;
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    return {
      text: parts.filter(part => part && !part.thought && typeof part.text === 'string').map(part => part.text).join('') || '',
      blocked: Boolean(result.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP'),
      usage: {
        inputTokens: tokenCount(result.usageMetadata?.promptTokenCount),
        outputTokens: tokenCount(result.usageMetadata?.candidatesTokenCount) + tokenCount(result.usageMetadata?.thoughtsTokenCount),
        thoughtTokens: tokenCount(result.usageMetadata?.thoughtsTokenCount),
      },
    };
  }
  return {
    text: (Array.isArray(result.content) ? result.content : []).filter(part => part?.type === 'text' && typeof part.text === 'string').map(part => part.text).join(''),
    blocked: result.stop_reason !== undefined && result.stop_reason !== 'end_turn',
    usage: { inputTokens: tokenCount(result.usage?.input_tokens), outputTokens: tokenCount(result.usage?.output_tokens) },
  };
}
