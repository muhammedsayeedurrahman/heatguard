import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.HEATGUARD_AI_MODE = 'local';

const { validatePlan } = await import('../src/lib/planSchema.js');
const { GENESIS_HASH, sealEntry, verifyChain } = await import('../src/lib/ledger.js');
const { prettyModelName, generateInterventionPackage, composeInterventionPackage } = await import('../src/core/interventionEngine.js');
const { buildConditionsSnapshot } = await import('../src/core/timeline.js');
const { findSite } = await import('../src/core/sites.js');

function samplePlan() {
  const site = findSite('chennai-metro');
  const local = generateInterventionPackage(site, buildConditionsSnapshot(site, { temp: 42.5, humidity: 70, solar: 1020, wind: 1.2 }));
  return {
    primaryRecommendation: local.primaryRecommendation,
    options: local.options,
    workerDirectives: local.workerDirectives,
    rationale: 'Dawn hours sit below the alert limit.',
    constraintChecks: [{ constraint: 'NIOSH rest minutes', satisfied: true, note: 'Enforced.' }],
  };
}

test('validatePlan accepts a complete trilingual plan', () => {
  assert.deepEqual(validatePlan(samplePlan()), []);
});

test('validatePlan rejects wrong scripts, option ids and extra fields', () => {
  const plan = samplePlan();
  plan.workerDirectives.ta = { ...plan.workerDirectives.en };
  plan.options[2] = { ...plan.options[2], id: 'opt-a' };
  assert.ok(validatePlan(plan).some((e) => e.includes('Tamil script')));
  assert.ok(validatePlan(plan).some((e) => e.includes('opt-a, opt-b, opt-c')));

  const extra = samplePlan();
  extra.primaryRecommendation.unexpected = 'x';
  assert.ok(validatePlan(extra).some((e) => e.includes('unexpected property')));
  assert.ok(validatePlan({}).length > 0);
});

test('audit ledger detects tampering', () => {
  const entries = [];
  let prev = GENESIS_HASH;
  for (let seq = 1; seq <= 3; seq += 1) {
    const sealed = sealEntry(prev, seq, { id: `E${seq}`, ts: '2026-01-01T00:00:00Z', siteId: 's', type: 'T', actor: 'a', details: `d${seq}`, severity: 'info', meta: { b: 1, a: 2 } });
    entries.push(sealed);
    prev = sealed.hash;
  }
  assert.equal(verifyChain(entries).valid, true);

  // Key order inside meta must not matter (DynamoDB does not preserve it).
  const reordered = entries.map((e) => ({ ...e, meta: { a: 2, b: 1 } }));
  assert.equal(verifyChain(reordered).valid, true);

  const tampered = structuredClone(entries);
  tampered[1].details = 'edited';
  assert.deepEqual(verifyChain(tampered), { valid: false, length: 3, brokenAtSeq: 2, headHash: null });
});

test('composeInterventionPackage keeps physics numbers from the baseline', () => {
  const site = findSite('delhi-logistics');
  const baseline = generateInterventionPackage(site, buildConditionsSnapshot(site, { temp: 44, humidity: 30, solar: 950, wind: 1.5 }));
  const engine = { provider: 'amazon-bedrock', modelId: 'anthropic.claude-sonnet-5-5' };
  const pkg = composeInterventionPackage(baseline, samplePlan(), engine);
  assert.equal(pkg.waterRequirementLiters, baseline.waterRequirementLiters);
  assert.equal(pkg.dangerWindow, baseline.dangerWindow);
  assert.equal(pkg.wbgtTrigger, baseline.wbgtTrigger);
  assert.equal(pkg.engine, engine);
});

test('prettyModelName formats Bedrock model IDs', () => {
  assert.equal(prettyModelName('anthropic.claude-sonnet-5-5'), 'Claude Sonnet 5.5');
  assert.equal(prettyModelName('anthropic.claude-haiku-4-5'), 'Claude Haiku 4.5');
  assert.equal(prettyModelName('global.anthropic.claude-opus-5'), 'Claude Opus 5');
  assert.equal(prettyModelName('us.anthropic.claude-3-5-sonnet-20241022-v2:0'), 'Claude Sonnet 3.5');
});

test('interventions API answers synchronously with the local engine when Bedrock is off', async () => {
  const { handler } = await import('../src/handlers/interventions.js');
  const response = await handler({
    routeKey: 'POST /api/sites/{siteId}/interventions',
    pathParameters: { siteId: 'chennai-metro' },
    body: JSON.stringify({ conditions: { temp: 38, humidity: 60, solar: 800, wind: 2 } }),
  });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.status, 'READY');
  assert.equal(body.engine.provider, 'local');
  assert.equal(body.package.options.length, 3);
});
