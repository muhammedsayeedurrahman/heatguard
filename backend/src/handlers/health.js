/**
 * Health / capability API: GET /api/health
 * Tells the frontend which services are live on AWS and which are running local stand-ins,
 * so it can label the UI honestly (AWS Cloud Live vs Calibrated Local Engine).
 */

import { prettyModelName } from '../core/interventionEngine.js';
import { getConfig, probeAwsCredentials, resolveServiceModes } from '../lib/config.js';
import { createApiHandler } from '../lib/http.js';
import { log } from '../lib/log.js';
import { getStore } from '../lib/store.js';

async function health({ query }) {
  if (query.refresh === '1') await probeAwsCredentials({ refresh: true });
  const config = getConfig();
  const modes = await resolveServiceModes();
  const store = await getStore();
  const lastBedrockCall = await store.getStatus('bedrock').catch((err) => {
    log.warn('Could not read Bedrock status', { error: err?.message });
    return null;
  });

  const services = {
    bedrock: {
      mode: modes.bedrock,
      modelId: config.bedrock.modelId,
      modelName: prettyModelName(config.bedrock.modelId),
      fallbackModelId: config.bedrock.fallbackModelId,
      region: config.bedrock.region,
      lastCall: lastBedrockCall,
    },
    dynamodb: { mode: modes.dynamodb, table: modes.dynamodb === 'live' ? config.tableName : null },
    eventbridge: { mode: modes.eventbridge, bus: modes.eventbridge === 'live' ? config.eventBusName : null },
    sns: { mode: modes.sns },
  };
  const live = [modes.bedrock === 'live', modes.dynamodb === 'live', modes.eventbridge === 'live', modes.sns === 'live'];

  return {
    status: 'ok',
    runtime: config.runtime,
    region: config.region,
    mode: live.every(Boolean) ? 'aws-live' : live.some(Boolean) ? 'hybrid' : 'local',
    credentials: { available: modes.credentials.available, source: modes.credentials.source ?? null },
    services,
    time: new Date().toISOString(),
  };
}

export const handler = createApiHandler({
  'GET /api/health': health,
});
