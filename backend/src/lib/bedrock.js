/**
 * Amazon Bedrock intervention planner (Claude in Amazon Bedrock, Messages API endpoint).
 *
 * Physics owns the numbers; Claude owns the plan. The WBGT engine derives hard constraints
 * (NIOSH work/rest ratio, danger window, water logistics), Claude turns them into feasible
 * strategies and trilingual worker directives, and the response is schema-validated before use.
 */

import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { NotFoundError, PermissionDeniedError } from '@anthropic-ai/sdk';
import { prettyModelName } from '../core/interventionEngine.js';
import { getConfig, isLambda } from './config.js';
import { PLAN_SCHEMA, validatePlan } from './planSchema.js';

const PLAN_TOOL_NAME = 'submit_intervention_plan';

// Kept byte-stable (no timestamps or IDs) so the tools + system prefix is cacheable.
const SYSTEM_PROMPT = `You are the intervention planner inside HeatGuard, an occupational heat-safety system used by site supervisors in India. A physics engine has already measured the heat hazard; your job is to turn its numbers into a plan a supervisor can approve in one tap and workers can follow immediately.

How the numbers work:
- WBGT is computed with the Liljegren outdoor formulation and compared with NIOSH Publication 2016-106 limits for the crew's metabolic workload. Treat every number in the request (WBGT, thresholds, required rest minutes per hour, hydration volume, danger window, person-hours averted, water liters) as measured fact. Do not recompute or alter them; quote them where useful.
- You may estimate percentages (risk reduction, productivity retained) and schedule effects, but keep them plausible and consistent across the plan.

Hard constraints:
- Every option must give workers at least the NIOSH rest minutes per hour stated in the request during the danger window. At EXTREME_DANGER, strenuous outdoor work stops during the danger window; plans may move it to cooler hours or night shifts.
- Plans must be feasible with the site's real resources: its worker count, number of shade hubs, shift hours and primary task. Do not invent equipment the site cannot plausibly obtain the same day.
- Never advise working through symptoms. Dizziness, cramps, confusion or nausea always mean stop, move to shade, and report.

Writing for workers:
- Many field workers have limited literacy and read on a phone in direct sun. Use short, plain sentences with concrete times and places.
- Write the Hindi directive in Devanagari script and the Tamil directive in Tamil script, as natural instructions a site foreman would give, not word-for-word translations.
- audioText is read aloud by text-to-speech: spell out numbers and units in words where that helps, and avoid symbols.

Options: give three genuinely different strategies (for example temporal rescheduling, crew rotation, active cooling). opt-a is the one you recommend, and primaryRecommendation describes opt-a.

Respond by calling the ${PLAN_TOOL_NAME} tool exactly once. List each hard constraint in constraintChecks with an honest assessment.`;

const PLAN_TOOL = {
  name: PLAN_TOOL_NAME,
  description:
    'Submit the complete heat-stress intervention plan for supervisor review. Call exactly once with every field filled in.',
  input_schema: PLAN_SCHEMA,
};

export class PlanError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

let client = null;

function getClient() {
  const { bedrock } = getConfig();
  // Lambda retries come from EventBridge; keep SDK retries low so failures fall back promptly.
  client ??= new AnthropicBedrockMantle({ awsRegion: bedrock.region, maxRetries: isLambda ? 1 : 2 });
  return client;
}

function buildRequest(modelId, { site, weather, facts }) {
  const { bedrock } = getConfig();
  const context = {
    site: {
      name: site.name,
      city: site.city,
      industry: site.industry,
      primaryTask: site.primaryTask,
      workIntensity: site.workIntensity,
      metabolicRateWatts: { LIGHT: 200, MODERATE: 300, HEAVY: 450 }[site.workIntensity],
      workerCount: site.workerCount,
      shiftHours: site.shift,
      shadeHubs: site.shadeHubs,
      surface: site.surfaceType,
      supervisor: site.supervisorName,
    },
    currentConditions: {
      dryBulbC: weather.temp,
      relativeHumidityPct: weather.humidity,
      solarIrradianceWm2: weather.solarRadiation,
      windSpeedMs: weather.windSpeed,
      wetBulbC: weather.wetBulb,
      globeTempC: weather.globeTemp,
      heatIndexC: weather.heatIndex,
      wbgtC: weather.wbgt,
    },
    nioshAssessment: {
      riskLevel: facts.riskLevel,
      thresholdsC: facts.thresholds,
      wbgtMinusAlertLimitC: facts.alertLimitDeltaC,
      requiredWorkRestRatio: facts.workRestRatio,
      maxWorkMinutesPerHour: facts.workMinutesPerHour,
      minRestMinutesPerHour: facts.restMinutesPerHour,
      hydrationPerWorkerMlPerHour: facts.hourlyHydrationMl,
      glassesOfWaterPerHour: facts.glassesPerHour,
    },
    shiftForecast: weather.timeline.map(({ time, temp, wbgt, riskLevel }) => ({ time, tempC: temp, wbgtC: wbgt, riskLevel })),
    planningFacts: {
      dangerWindow: facts.dangerWindow,
      dangerHours: facts.dangerHours,
      totalElectrolyteWaterLiters: facts.waterRequirementLiters,
      personHoursOfExposureAverted: facts.personHoursAverted,
    },
  };

  const request = {
    model: modelId,
    max_tokens: bedrock.maxTokens,
    // Explicit breakpoint: Bedrock does not support top-level automatic caching.
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [PLAN_TOOL],
    // Current Claude models reject forced tool_choice; the system prompt requires the call.
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    messages: [
      {
        role: 'user',
        content: `Plan today's heat-stress intervention for this site.\n\n${JSON.stringify(context, null, 2)}`,
      },
    ],
  };
  // Haiku-class models do not take the effort parameter.
  if (bedrock.effort && bedrock.effort !== 'none' && !/haiku/.test(modelId)) {
    request.output_config = { effort: bedrock.effort };
  }
  return request;
}

function isModelAccessError(err) {
  return err instanceof PermissionDeniedError || err instanceof NotFoundError;
}

/**
 * Returns { plan, engine } or throws (PlanError for unusable responses, SDK errors otherwise).
 */
export async function synthesizePlan(input) {
  const { bedrock } = getConfig();
  const models = [...new Set([bedrock.modelId, bedrock.fallbackModelId].filter(Boolean))];
  let lastAccessError = null;

  for (const modelId of models) {
    const started = Date.now();
    let response;
    try {
      response = await getClient().messages.create(buildRequest(modelId, input), { timeout: bedrock.timeoutMs });
    } catch (err) {
      if (isModelAccessError(err) && modelId !== models[models.length - 1]) {
        lastAccessError = err;
        continue; // Model not enabled for this account/region: try the fallback model.
      }
      throw err;
    }

    if (response.stop_reason === 'refusal') {
      throw new PlanError('refusal', `Model declined the request (${response.stop_details?.category ?? 'unspecified'})`);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new PlanError('max_tokens', `Plan truncated at max_tokens=${bedrock.maxTokens}`);
    }
    const toolUse = response.content.find((block) => block.type === 'tool_use' && block.name === PLAN_TOOL_NAME);
    if (!toolUse) throw new PlanError('no_tool_call', 'Model answered without submitting a plan');

    const problems = validatePlan(toolUse.input);
    if (problems.length) {
      throw new PlanError('invalid_plan', `Plan failed validation: ${problems.slice(0, 4).join('; ')}`);
    }

    const usedModel = response.model || modelId;
    return {
      plan: toolUse.input,
      engine: {
        provider: 'amazon-bedrock',
        label: `AWS Cloud Live: ${prettyModelName(usedModel)}`,
        modelId: usedModel,
        modelName: prettyModelName(usedModel),
        region: bedrock.region,
        latencyMs: Date.now() - started,
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
          cacheReadInputTokens: response.usage?.cache_read_input_tokens ?? 0,
          cacheCreationInputTokens: response.usage?.cache_creation_input_tokens ?? 0,
        },
        ...(modelId !== bedrock.modelId
          ? { fallbackFrom: bedrock.modelId, fallbackCause: lastAccessError?.message?.slice(0, 200) }
          : {}),
        guardrails: [
          'Plan schema validated server-side',
          'Three distinct strategies (opt-a/b/c)',
          'Hindi (Devanagari) and Tamil script verified',
          'WBGT, danger window and water logistics locked to physics engine',
        ],
      },
    };
  }
  throw lastAccessError ?? new PlanError('no_model', 'No Bedrock model configured');
}

/** Short, user-safe description of why Bedrock could not be used. */
export function describeBedrockFailure(err) {
  if (err instanceof PlanError) return err.message;
  if (err instanceof PermissionDeniedError) return 'Bedrock model access denied (enable the model in the Bedrock console or check IAM)';
  if (err instanceof NotFoundError) return 'Bedrock model not found in this region';
  if (err?.name === 'APIConnectionTimeoutError') return 'Bedrock request timed out';
  return `${err?.name || 'Error'}: ${String(err?.message || err).slice(0, 160)}`;
}
