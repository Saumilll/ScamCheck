import { RULES, SCORING, getRiskLevel } from '@/lib/scamRules';

/** Return a short snippet of the text that triggered a rule, or null. */
function findEvidence(rule, text) {
  if (typeof rule.check === 'function') {
    return rule.check(text);
  }
  for (const pattern of rule.patterns || []) {
    const match = text.match(pattern);
    if (match) return match[0].trim().slice(0, 90);
  }
  return null;
}

function severityFor(weight) {
  const { high, medium } = SCORING.severityByWeight;
  if (weight >= high) return 'high';
  if (weight >= medium) return 'medium';
  return 'low';
}

/**
 * Layer 1: fast, offline rule scan.
 * @param {'message'|'job'|'profile'} inputType
 * @param {string} text
 * @returns {{ score: number, flags: Array<object> }}
 */
export function runHeuristics(inputType, text) {
  const flags = [];
  const firedIds = new Set();
  let total = 0;

  for (const rule of RULES) {
    if (rule.appliesTo && !rule.appliesTo.includes(inputType)) continue;
    const evidence = findEvidence(rule, text);
    if (!evidence) continue;

    firedIds.add(rule.id);
    total += rule.weight;
    flags.push({
      id: rule.id,
      source: 'rules',
      label: rule.label,
      explanation: rule.explanation,
      severity: severityFor(rule.weight),
      evidence,
    });
  }

  for (const combo of SCORING.comboBonuses) {
    if (combo.ids.every((id) => firedIds.has(id))) {
      total += combo.bonus;
      flags.push({
        id: `combo-${combo.ids.join('-')}`,
        source: 'rules',
        label: 'Dangerous combination',
        explanation: combo.label,
        severity: 'high',
        evidence: null,
      });
    }
  }

  return { score: Math.min(100, total), flags };
}

/**
 * Blend the rule score with the (optional) AI score.
 * Tune the weights in lib/scamRules.js -> SCORING.
 */
export function combineScores(ruleScore, aiScore) {
  if (aiScore === null || aiScore === undefined) {
    return { score: ruleScore, level: getRiskLevel(ruleScore) };
  }

  const blended = Math.round(ruleScore * SCORING.heuristicWeight + aiScore * SCORING.aiWeight);
  let score = Math.max(blended, Math.round(aiScore * SCORING.aiFloorFactor));

  if (ruleScore >= SCORING.heuristicFloor.minScore) {
    score = Math.max(score, Math.round(ruleScore * SCORING.heuristicFloor.factor));
  }

  score = Math.max(0, Math.min(100, score));
  return { score, level: getRiskLevel(score) };
}
