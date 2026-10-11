/**
 * Builds the web app and publishes it to the stack's S3 bucket + CloudFront distribution.
 * The app calls /api/* on its own origin, which CloudFront proxies to API Gateway.
 */

import { execFileSync } from 'node:child_process';
import { aws, getStackOutputs } from './stackOutputs.mjs';

const outputs = getStackOutputs();
if (!outputs.FrontendBucketName || !outputs.FrontendDistributionId) {
  console.error('Stack has no frontend resources (deployed with DeployFrontend=false?).');
  process.exit(1);
}

execFileSync('npm', ['run', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' });

const bucket = `s3://${outputs.FrontendBucketName}`;
// Hashed assets are immutable; index.html must always revalidate.
aws(['s3', 'sync', 'dist', bucket, '--delete', '--exclude', 'index.html', '--cache-control', 'public,max-age=31536000,immutable'], { inherit: true });
aws(['s3', 'cp', 'dist/index.html', `${bucket}/index.html`, '--cache-control', 'no-cache'], { inherit: true });
aws(['cloudfront', 'create-invalidation', '--distribution-id', outputs.FrontendDistributionId, '--paths', '/index.html'], { inherit: true });

console.log(`\nHeatGuard is live at ${outputs.AppUrl}`);
