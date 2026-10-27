import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/scamRules';

/**
 * Layer 2: LLM analysis through any OpenAI-compatible chat API.
 * Groq, Google Gemini and OpenAI are all supported with plain fetch (no SDK needed).
 */
const PROVIDERS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    // First model is the default. The others are tried automatically if a model is "not found" (404).
    models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b'],
    jsonMode: true,
    maxTokens: 2500, // reasoning models spend tokens thinking, so leave room for the answer
  },
  gemini: {
    // Native Gemini API (works with both the old AIza keys and the new AQ. keys).
    native: true,
    url: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
    jsonMode: false,
    maxTokens: null,
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o-mini', 'gpt-4.1-mini'],
    jsonMode: true,
    maxTokens: 900,
  },
};

const MAX_CHARS_SENT = 6000;
const TIMEOUT_MS = 25000;

export function isAiConfigured() {
  return Boolean((process.env.AI_API_KEY || '').trim());
}

export function detectProvider() {
  const explicit = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (PROVIDERS[explicit]) return explicit;

  const key = (process.env.AI_API_KEY || '').trim();
  if (key.startsWith('gsk_')) return 'groq';
  if (key.startsWith('AIza') || key.startsWith('AQ.')) return 'gemini';
  return 'openai';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function cleanString(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function extractJson(raw) {
  const text = String(raw || '').replace(/```json|```/gi, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('The AI reply did not contain JSON.');
  }
  return JSON.parse(text.slice(start, end + 1));
}

function normalize(parsed) {
  const score = clamp(Math.round(Number(parsed.riskScore)), 0, 100);
  if (Number.isNaN(score)) throw new Error('The AI reply had no valid riskScore.');

  const reasons = (Array.isArray(parsed.reasons) ? parsed.reasons : [])
    .slice(0, 6)
    .map((r, i) => ({
      id: `ai-${i}`,
      source: 'ai',
      label: cleanString(r?.title, 90) || 'AI-detected concern',
      explanation: cleanString(r?.detail, 320),
      severity: ['low', 'medium', 'high'].includes(r?.severity) ? r.severity : 'medium',
      evidence: null,
    }))
    .filter((r) => r.label);

  return {
    score,
    summary: cleanString(parsed.summary, 400),
    flags: reasons,
    techniques: (Array.isArray(parsed.techniques) ? parsed.techniques : [])
      .map((t) => cleanString(t, 60))
      .filter(Boolean)
      .slice(0, 6),
    tips: (Array.isArray(parsed.safetyTips) ? parsed.safetyTips : [])
      .map((t) => cleanString(t, 200))
      .filter(Boolean)
      .slice(0, 3),
  };
}

class ModelNotFoundError extends Error {}

function notFound(providerName, model, detail) {
  return new ModelNotFoundError(
    `Model "${model}" was not found on ${providerName} (it may have been retired). Set AI_MODEL in .env.local to a current model name. ${detail}`
  );
}

async function callGemini(provider, model, apiKey, inputType, text, ruleFlags) {
  const url = `${provider.url.replace(/\/$/, '')}/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [{ text: buildUserPrompt(inputType, text.slice(0, MAX_CHARS_SENT), ruleFlags) }],
      },
    ],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 240);
      if (res.status === 404) throw notFound('gemini', model, detail);
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `gemini rejected the API key (${res.status}). Check AI_API_KEY has no quotes or spaces, and that the key is for the Gemini API. ${detail}`
        );
      }
      throw new Error(`gemini returned ${res.status}. ${detail}`);
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const content = parts.map((p) => p.text || '').join('');
    if (!content) {
      const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'empty reply';
      throw new Error(`gemini returned no text (${reason}).`);
    }
    return normalize(extractJson(content));
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The AI request timed out.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function callModel(provider, providerName, model, apiKey, inputType, text, ruleFlags) {
  if (provider.native) return callGemini(provider, model, apiKey, inputType, text, ruleFlags);

  const body = {
    model,
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(inputType, text.slice(0, MAX_CHARS_SENT), ruleFlags) },
    ],
  };
  if (provider.jsonMode) body.response_format = { type: 'json_object' };
  if (provider.maxTokens) body.max_tokens = provider.maxTokens;
  if (providerName === 'groq' && model.includes('gpt-oss')) body.reasoning_effort = 'low';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      if (res.status === 404) {
        throw notFound(providerName, model, detail);
      }
      throw new Error(`${providerName} returned ${res.status}. ${detail}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return normalize(extractJson(content));
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The AI request timed out.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {Promise<{score:number, summary:string, flags:Array, techniques:string[], tips:string[], provider:string, model:string}>}
 * Throws on failure — the caller decides how to fall back.
 */
export async function runAiAnalysis(inputType, text, ruleFlags) {
  const apiKey = (process.env.AI_API_KEY || '').trim();
  if (!apiKey) throw new Error('AI_API_KEY is not set.');

  const providerName = detectProvider();
  const provider = PROVIDERS[providerName];
  const custom = (process.env.AI_BASE_URL || '').trim();
  const endpoint = custom ? { ...provider, url: custom } : provider;

  const explicitModel = (process.env.AI_MODEL || '').trim();
  const candidates = explicitModel ? [explicitModel] : provider.models;

  let lastError = null;
  for (const model of candidates) {
    try {
      const result = await callModel(endpoint, providerName, model, apiKey, inputType, text, ruleFlags);
      return { ...result, provider: providerName, model };
    } catch (err) {
      lastError = err;
      if (!(err instanceof ModelNotFoundError)) throw err; // only a 404 moves on to the next model
    }
  }
  throw lastError;
}
