/**
 * Writes .env.local from the deployed stack so `npm run dev` runs the local API handlers against
 * the live DynamoDB table, EventBridge bus and SNS topics (uses your AWS CLI credentials).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getStackOutputs, region, stackName } from './stackOutputs.mjs';

const outputs = getStackOutputs();
const managed = {
  AWS_REGION: region,
  HEATGUARD_TABLE_NAME: outputs.TableName,
  HEATGUARD_EVENT_BUS_NAME: outputs.EventBusName,
  HEATGUARD_BROADCAST_TOPIC_ARN: outputs.BroadcastTopicArn,
  HEATGUARD_ALERTS_TOPIC_ARN: outputs.AlertsTopicArn,
  BEDROCK_MODEL_ID: outputs.BedrockModelId,
};

// Keep any other settings already in .env.local.
const kept = existsSync('.env.local')
  ? readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim() && !Object.keys(managed).some((key) => line.startsWith(`${key}=`)))
  : [];

const lines = [`# Generated from stack "${stackName}" by npm run aws:env`, ...Object.entries(managed).map(([k, v]) => `${k}=${v}`), ...kept];
writeFileSync('.env.local', `${lines.join('\n')}\n`);
console.log(`Wrote .env.local for stack ${stackName} (${region}). Run \`npm run dev\` to use the live AWS resources.`);
