/**
 * Runtime configuration & AWS capability detection.
 *
 * Each AWS service is independently "live" or falls back to a local stand-in, so the same
 * code runs in Lambda (everything live), on a laptop with credentials and deployed stack
 * outputs (live), with credentials only (Bedrock live, rest local), or fully offline.
 */

import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const env = (name, fallback = '') => {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
};

export const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

export function getConfig() {
  return {
    runtime: isLambda ? 'aws-lambda' : 'local-dev',
    region: env('AWS_REGION', env('AWS_DEFAULT_REGION', 'us-east-1')),
    tableName: env('HEATGUARD_TABLE_NAME'),
    eventBusName: env('HEATGUARD_EVENT_BUS_NAME'),
    broadcastTopicArn: env('HEATGUARD_BROADCAST_TOPIC_ARN'),
    alertsTopicArn: env('HEATGUARD_ALERTS_TOPIC_ARN'),
    bedrock: {
      // "auto" uses Bedrock whenever AWS credentials resolve; "local" forces the calibrated engine.
      mode: env('HEATGUARD_AI_MODE', 'auto'),
      region: env('BEDROCK_REGION', env('AWS_REGION', env('AWS_DEFAULT_REGION', 'us-east-1'))),
      modelId: env('BEDROCK_MODEL_ID', 'anthropic.claude-sonnet-5-5'),
      // Used when the primary model is not enabled for the account (403/404 from Bedrock).
      fallbackModelId: env('BEDROCK_FALLBACK_MODEL_ID', 'anthropic.claude-sonnet-5'),
      effort: env('BEDROCK_EFFORT', 'low'),
      maxTokens: Number(env('BEDROCK_MAX_TOKENS', '12000')),
      timeoutMs: Number(env('BEDROCK_TIMEOUT_MS', isLambda ? '100000' : '120000')),
    },
    planCacheTtlSeconds: Number(env('HEATGUARD_PLAN_CACHE_TTL_SECONDS', '1800')),
  };
}

let credentialProbe = null;

/**
 * Resolves AWS credentials once per process (Lambda always has them).
 * Returns { available, source, error } without throwing.
 */
export function probeAwsCredentials({ refresh = false } = {}) {
  if (isLambda) return Promise.resolve({ available: true, source: 'lambda-execution-role' });
  if (credentialProbe && !refresh) return credentialProbe;

  const timeout = new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ available: false, error: 'credential resolution timed out' }), 3500);
    timer.unref?.();
  });
  const resolveChain = fromNodeProviderChain()()
    .then((creds) => ({
      available: Boolean(creds?.accessKeyId),
      source: process.env.AWS_PROFILE ? `profile:${process.env.AWS_PROFILE}` : 'default-chain',
    }))
    .catch((err) => ({ available: false, error: err?.name || 'CredentialsProviderError' }));

  credentialProbe = Promise.race([resolveChain, timeout]);
  return credentialProbe;
}

/**
 * Which services run against real AWS for this process.
 * EventBridge is only live when DynamoDB is, because rule targets (Synthesis/Dispatch Lambdas)
 * write to the deployed table; mixing a live bus with an in-memory store would split state.
 */
export async function resolveServiceModes() {
  const config = getConfig();
  const creds = await probeAwsCredentials();
  const hasCreds = creds.available;
  const dynamodb = hasCreds && config.tableName ? 'live' : 'memory';
  return {
    credentials: creds,
    bedrock: hasCreds && config.bedrock.mode !== 'local' ? 'live' : 'local',
    dynamodb,
    eventbridge: dynamodb === 'live' && config.eventBusName ? 'live' : 'in-process',
    sns: hasCreds && config.broadcastTopicArn && config.alertsTopicArn ? 'live' : 'simulated',
  };
}
