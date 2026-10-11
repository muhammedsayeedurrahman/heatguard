/**
 * Minimal API Gateway (HTTP API, payload v2) handler kit: routing by routeKey,
 * JSON parsing, input validation helpers and uniform error responses.
 */

import { randomUUID } from 'node:crypto';
import { findSite } from '../core/sites.js';
import { log } from './log.js';

export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function json(statusCode, body) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed;
  } catch {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
}

/**
 * Builds a Lambda handler that dispatches on the HTTP API routeKey,
 * e.g. { 'GET /api/sites/{siteId}/roster': getRoster }.
 */
export function createApiHandler(routes) {
  const handler = async (event, context) => {
    const requestId = context?.awsRequestId || randomUUID();
    const routeKey = event.routeKey;
    const route = routes[routeKey];
    if (!route) return json(404, { error: `No route for ${routeKey}` });

    try {
      const request = {
        params: event.pathParameters || {},
        query: event.queryStringParameters || {},
        body: parseBody(event),
        requestId,
      };
      const result = await route(request);
      return json(result?.statusCode || 200, result?.body ?? result);
    } catch (err) {
      if (err instanceof HttpError) return json(err.statusCode, { error: err.message });
      log.error('Unhandled API error', { routeKey, requestId, error: err?.message, stack: err?.stack });
      return json(500, { error: 'Internal error', requestId });
    }
  };
  handler.routes = Object.keys(routes);
  return handler;
}

export function requireSite(siteId) {
  const site = findSite(siteId);
  if (!site) throw new HttpError(404, `Unknown site "${siteId}"`);
  return site;
}

export function clampNumber(value, min, max, field) {
  const num = Number(value);
  if (!Number.isFinite(num)) throw new HttpError(400, `"${field}" must be a number`);
  return Math.min(max, Math.max(min, num));
}

export function optionalString(value, field, maxLength = 500) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new HttpError(400, `"${field}" must be a string`);
  return value.slice(0, maxLength);
}

export function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new HttpError(400, `"${field}" must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

/** Client-supplied event IDs double as idempotency keys for the audit ledger. */
export function eventIdFrom(value) {
  if (typeof value === 'string' && EVENT_ID_PATTERN.test(value)) return value;
  return `EVT-${randomUUID()}`;
}
