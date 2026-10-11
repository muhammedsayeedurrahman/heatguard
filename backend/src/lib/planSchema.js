/**
 * JSON Schema for the intervention plan Claude submits via the `submit_intervention_plan` tool,
 * plus a validator. Claude in Amazon Bedrock does not support structured outputs, so every
 * tool input is validated here before it can reach a supervisor or a worker.
 */

const text = (description) => ({ type: 'string', description });

const directive = {
  type: 'object',
  properties: {
    title: text('Short directive headline (max ~6 words).'),
    shiftAdjustment: text('One sentence: the concrete schedule change, with clock times and the shade hub.'),
    actionSteps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Exactly 3 short, concrete steps a worker can follow immediately (max ~15 words each).',
    },
    oneTapMessage: text('First-person confirmation the worker taps, e.g. "I am resting in shade and hydrated" (max ~8 words).'),
    audioText: text('2-3 sentence announcement for text-to-speech, plain words, no symbols or abbreviations.'),
  },
  required: ['title', 'shiftAdjustment', 'actionSteps', 'oneTapMessage', 'audioText'],
  additionalProperties: false,
};

export const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    primaryRecommendation: {
      type: 'object',
      properties: {
        title: text('Name of the recommended intervention (max ~8 words).'),
        summary: text('2-3 sentences: what changes, when, where, and the logistics, using the provided numbers.'),
        regulatoryBasis: text('One sentence citing NIOSH 2016-106 / OSHA and the measured WBGT versus the alert limit.'),
        operationalTradeoff: {
          type: 'object',
          properties: {
            projectScheduleImpact: text('Net schedule effect, e.g. "0 hours net delay (offset by morning shift)".'),
            crewEfficiencyRetention: text('Estimated productivity retained, e.g. "85% vs 45% unmitigated".'),
            heatStrokeRiskMitigation: text('Estimated heat-illness risk reduction, e.g. "80% risk reduction".'),
          },
          required: ['projectScheduleImpact', 'crewEfficiencyRetention', 'heatStrokeRiskMitigation'],
          additionalProperties: false,
        },
      },
      required: ['title', 'summary', 'regulatoryBasis', 'operationalTradeoff'],
      additionalProperties: false,
    },
    options: {
      type: 'array',
      description: 'Exactly three distinct strategies with ids opt-a, opt-b, opt-c. opt-a is the recommended one.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ['opt-a', 'opt-b', 'opt-c'] },
          name: text('Prefixed "Option A:", "Option B:" or "Option C:"; mark the recommended one "(Recommended)".'),
          description: text('1-2 sentences with concrete times, crew split or equipment.'),
          riskReduction: text('Estimated exposure reduction as a whole percentage string, e.g. "80%".'),
          operationalComplexity: { type: 'string', enum: ['Low', 'Medium', 'High'] },
        },
        required: ['id', 'name', 'description', 'riskReduction', 'operationalComplexity'],
        additionalProperties: false,
      },
    },
    workerDirectives: {
      type: 'object',
      description: 'The same directive for field workers in English, Hindi (Devanagari script) and Tamil (Tamil script).',
      properties: { en: directive, hi: directive, ta: directive },
      required: ['en', 'hi', 'ta'],
      additionalProperties: false,
    },
    rationale: text('2-4 sentences for the supervisor: why this plan fits the physics constraints and this site.'),
    constraintChecks: {
      type: 'array',
      description: 'One entry per hard constraint you were given, stating whether the plan satisfies it.',
      items: {
        type: 'object',
        properties: {
          constraint: text('The constraint, briefly.'),
          satisfied: { type: 'boolean' },
          note: text('How the plan satisfies it, or why it cannot.'),
        },
        required: ['constraint', 'satisfied', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: ['primaryRecommendation', 'options', 'workerDirectives', 'rationale', 'constraintChecks'],
  additionalProperties: false,
};

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function validateNode(schema, value, path, errors) {
  if (typeOf(value) !== schema.type) {
    errors.push(`${path}: expected ${schema.type}, got ${typeOf(value)}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: "${value}" not in enum`);
  if (schema.type === 'string' && !value.trim()) errors.push(`${path}: empty string`);
  if (schema.type === 'array') value.forEach((item, i) => validateNode(schema.items, item, `${path}[${i}]`, errors));
  if (schema.type === 'object') {
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${path}.${key}: missing`);
    }
    for (const [key, child] of Object.entries(value)) {
      const childSchema = schema.properties?.[key];
      if (!childSchema) {
        if (schema.additionalProperties === false) errors.push(`${path}.${key}: unexpected property`);
        continue;
      }
      validateNode(childSchema, child, `${path}.${key}`, errors);
    }
  }
}

const DEVANAGARI = /[ऀ-ॿ]/;
const TAMIL = /[஀-௿]/;

/** Returns a list of problems; empty means the plan is safe to show. */
export function validatePlan(plan) {
  const errors = [];
  validateNode(PLAN_SCHEMA, plan, 'plan', errors);
  if (errors.length) return errors;

  const ids = plan.options.map((option) => option.id).sort().join(',');
  if (ids !== 'opt-a,opt-b,opt-c') errors.push(`options: expected ids opt-a, opt-b, opt-c, got ${ids}`);
  plan.options.forEach((option, i) => {
    if (!/^\d{1,3}%$/.test(option.riskReduction)) errors.push(`options[${i}].riskReduction: "${option.riskReduction}"`);
  });
  for (const lang of ['en', 'hi', 'ta']) {
    const steps = plan.workerDirectives[lang].actionSteps;
    if (steps.length < 2 || steps.length > 5) errors.push(`workerDirectives.${lang}.actionSteps: ${steps.length} steps`);
  }
  const hindi = Object.values(plan.workerDirectives.hi).flat().join(' ');
  const tamil = Object.values(plan.workerDirectives.ta).flat().join(' ');
  if (!DEVANAGARI.test(hindi)) errors.push('workerDirectives.hi: not in Devanagari script');
  if (!TAMIL.test(tamil)) errors.push('workerDirectives.ta: not in Tamil script');
  if (!plan.constraintChecks.length) errors.push('constraintChecks: empty');
  return errors;
}
