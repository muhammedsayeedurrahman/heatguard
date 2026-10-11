/**
 * Amazon SNS notifications: worker broadcasts (multilingual directives, nudges) and
 * supervisor safety alerts (SOS, compliance exceptions, risk escalations).
 */

import { randomUUID } from 'node:crypto';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { getConfig, resolveServiceModes } from './config.js';
import { log } from './log.js';

export const Topics = Object.freeze({ BROADCAST: 'broadcast', ALERTS: 'alerts' });

let client = null;

export async function notify(topic, { subject, message, attributes = {} }) {
  const modes = await resolveServiceModes();
  const config = getConfig();
  const topicArn = topic === Topics.ALERTS ? config.alertsTopicArn : config.broadcastTopicArn;

  if (modes.sns !== 'live') {
    log.info('SNS (simulated) publish', { topic, subject, attributes });
    return { messageId: `sim-${randomUUID().slice(0, 8)}`, transport: 'simulated' };
  }

  client ??= new SNSClient({ region: config.region });
  const result = await client.send(
    new PublishCommand({
      TopicArn: topicArn,
      // SNS subjects: ASCII, no newlines, <= 100 chars.
      Subject: subject.replace(/[^\x20-\x7E]/g, '').slice(0, 100),
      Message: message,
      MessageAttributes: Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [key, { DataType: 'String', StringValue: String(value) }])
      ),
    })
  );
  return { messageId: result.MessageId, transport: 'sns' };
}
