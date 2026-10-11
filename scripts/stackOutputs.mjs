/**
 * Reads the deployed CloudFormation stack outputs with the AWS CLI.
 * Stack name / region: HEATGUARD_STACK (default "heatguard") and AWS_REGION (default us-east-1).
 */

import { execFileSync } from 'node:child_process';

export const stackName = process.env.HEATGUARD_STACK || 'heatguard';
export const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

export function aws(args, options = {}) {
  return execFileSync('aws', [...args, '--region', region], {
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
  });
}

export function getStackOutputs() {
  const raw = aws(['cloudformation', 'describe-stacks', '--stack-name', stackName, '--query', 'Stacks[0].Outputs', '--output', 'json']);
  return Object.fromEntries(JSON.parse(raw).map((output) => [output.OutputKey, output.OutputValue]));
}
