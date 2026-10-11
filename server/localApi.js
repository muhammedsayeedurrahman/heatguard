/**
 * HeatGuard local API - runs the exact Lambda handlers from backend/ behind a tiny router that
 * emulates API Gateway (HTTP API, payload v2). Used two ways:
 *   1. As Vite middleware: `npm run dev` serves the frontend and /api/* from one port.
 *   2. Standalone:         `npm run api` (http://localhost:8787) for curl / integration tests.
 *
 * With AWS credentials (and optionally deployed stack outputs in .env.local) the handlers call
 * the real Bedrock / DynamoDB / EventBridge / SNS; without them every service falls back locally.
 */

import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const HANDLER_MODULES = ['health', 'interventions', 'workforce', 'audit'];
const MAX_BODY_BYTES = 256 * 1024;

function compileRoute(routeKey, handler) {
  const [method, template] = routeKey.split(' ');
  const names = [];
  const pattern = template.replace(/\{(\w+)\}/g, (_, name) => {
    names.push(name);
    return '([^/]+)';
  });
  return { method, routeKey, handler, names, regex: new RegExp(`^${pattern}/?$`) };
}

async function loadRoutes() {
  const routes = [];
  for (const name of HANDLER_MODULES) {
    const { handler } = await import(`../backend/src/handlers/${name}.js`);
    handler.routes.forEach((routeKey) => routes.push(compileRoute(routeKey, handler)));
  }
  return routes;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

/** Copies AWS / HeatGuard settings from Vite-loaded .env files into process.env. */
export function applyEnv(env = {}) {
  for (const [key, value] of Object.entries(env)) {
    if (/^(AWS_|HEATGUARD_|BEDROCK_)/.test(key) && process.env[key] === undefined) process.env[key] = value;
  }
}

export async function createLocalApiMiddleware() {
  const routes = await loadRoutes();
  const { resolveServiceModes } = await import('../backend/src/lib/config.js');
  resolveServiceModes().then((modes) =>
    console.log(
      `[heatguard-api] bedrock=${modes.bedrock} dynamodb=${modes.dynamodb} eventbridge=${modes.eventbridge} sns=${modes.sns}` +
        (modes.credentials.available ? ` (credentials: ${modes.credentials.source})` : ' (no AWS credentials: local fallbacks)')
    )
  );

  return async function localApi(req, res, next) {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next?.();

    const match = routes
      .filter((route) => route.method === req.method)
      .map((route) => ({ route, result: route.regex.exec(url.pathname) }))
      .find(({ result }) => result);
    if (!match) {
      return send(res, 404, { 'content-type': 'application/json' }, JSON.stringify({ error: `No route for ${req.method} ${url.pathname}` }));
    }

    try {
      const body = await readBody(req);
      const event = {
        version: '2.0',
        routeKey: match.route.routeKey,
        rawPath: url.pathname,
        rawQueryString: url.search.slice(1),
        pathParameters: Object.fromEntries(match.route.names.map((name, i) => [name, decodeURIComponent(match.result[i + 1])])),
        queryStringParameters: Object.fromEntries(url.searchParams),
        headers: req.headers,
        body: body || undefined,
        isBase64Encoded: false,
        requestContext: { http: { method: req.method, path: url.pathname }, requestId: randomUUID() },
      };
      const response = await match.route.handler(event, { awsRequestId: event.requestContext.requestId });
      send(res, response.statusCode, response.headers, response.body);
    } catch (err) {
      send(res, err.statusCode || 500, { 'content-type': 'application/json' }, JSON.stringify({ error: err.message }));
    }
  };
}

// Standalone mode: node server/localApi.js
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8787);
  const middleware = await createLocalApiMiddleware();
  createServer((req, res) =>
    middleware(req, res, () => send(res, 404, { 'content-type': 'text/plain' }, 'Not found'))
  ).listen(port, () => console.log(`[heatguard-api] listening on http://localhost:${port}/api/health`));
}
