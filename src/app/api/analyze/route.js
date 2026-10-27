import { NextResponse } from 'next/server';
import { INPUT_LIMITS, INPUT_TYPES, LEVELS, SAFETY_TIPS } from '@/lib/scamRules';
import { combineScores, runHeuristics } from '@/lib/heuristics';
import { isAiConfigured, runAiAnalysis } from '@/lib/ai';
import { saveScan } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function mergeTips(level, aiTips) {
  const merged = [...(aiTips || []), ...SAFETY_TIPS[level]];
  const seen = new Set();
  return merged.filter((tip) => {
    const key = tip.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('Send a JSON body with "inputType" and "text".');
  }

  const inputType = body?.inputType;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';

  if (!INPUT_TYPES.includes(inputType)) {
    return fail(`"inputType" must be one of: ${INPUT_TYPES.join(', ')}.`);
  }
  if (text.length < INPUT_LIMITS.min) {
    return fail(`Paste at least ${INPUT_LIMITS.min} characters so there is something to check.`);
  }
  if (text.length > INPUT_LIMITS.max) {
    return fail(`That is too long. Keep it under ${INPUT_LIMITS.max} characters.`);
  }

  // Layer 1: rules
  const rules = runHeuristics(inputType, text);

  // Layer 2: AI (optional, never blocks the result)
  let ai = null;
  let aiError = null;
  const aiEnabled = isAiConfigured();
  if (aiEnabled) {
    try {
      ai = await runAiAnalysis(inputType, text, rules.flags);
    } catch (err) {
      aiError = err.message;
      console.error('[analyze] AI layer failed:', err.message);
    }
  }

  const { score, level } = combineScores(rules.score, ai ? ai.score : null);
  const flags = [...rules.flags, ...(ai ? ai.flags : [])];

  // Persist (best effort — a database problem should not hide the result)
  let saved = null;
  let dbDriver = null;
  let dbNote = '';
  try {
    const result = await saveScan({
      inputType,
      inputText: text,
      riskScore: score,
      riskLevel: level,
      reasons: flags,
    });
    saved = result.scan;
    dbDriver = result.driver;
    dbNote = result.note;
  } catch (err) {
    dbNote = 'Could not save this scan to the database.';
    console.error('[analyze] save failed:', err);
  }

  return NextResponse.json({
    id: saved?.id || null,
    createdAt: saved?.createdAt || new Date().toISOString(),
    inputType,
    riskScore: score,
    riskLevel: level,
    label: LEVELS[level].label,
    summary: (ai && ai.summary) || LEVELS[level].summary,
    flags,
    techniques: ai ? ai.techniques : [],
    tips: mergeTips(level, ai ? ai.tips : []),
    engine: {
      ruleScore: rules.score,
      aiScore: ai ? ai.score : null,
      aiEnabled,
      aiUsed: Boolean(ai),
      aiError,
      provider: ai ? ai.provider : null,
      model: ai ? ai.model : null,
    },
    saved: Boolean(saved),
    dbDriver,
    dbNote,
  });
}
