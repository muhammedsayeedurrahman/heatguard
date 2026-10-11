/**
 * HeatGuard cloud API client.
 *
 * Talks to the AWS backend (API Gateway -> Lambda), or to the same handlers served locally by
 * Vite. Every call fails soft: callers fall back to the Calibrated Local Engine when the API is
 * unreachable. Mutations made while offline are queued in an outbox and replayed on reconnect;
 * client-generated event IDs make replays idempotent in the DynamoDB audit ledger.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body, { timeoutMs = 8000 } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ApiError(0, err?.name === 'TimeoutError' ? 'Request timed out' : 'Network unreachable');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || res.statusText);
  if (data === null) throw new ApiError(res.status, 'Response was not JSON');
  return data;
}

const site = (siteId) => `/api/sites/${encodeURIComponent(siteId)}`;

/* ---------------------------- offline outbox ---------------------------- */

let offline = false;
const outbox = [];

async function mutate(method, path, body) {
  if (offline) {
    outbox.push({ method, path, body });
    return { queued: true };
  }
  try {
    return await request(method, path, body);
  } catch (err) {
    // Network failures are retried later; validation errors (4xx) are not.
    if (err.status === 0) {
      outbox.push({ method, path, body });
      return { queued: true };
    }
    throw err;
  }
}

export async function flushOutbox() {
  let delivered = 0;
  while (!offline && outbox.length) {
    const next = outbox[0];
    try {
      await request(next.method, next.path, next.body);
    } catch (err) {
      if (err.status === 0) break; // Still unreachable: keep the rest queued.
      console.warn('[HeatGuard] Dropping rejected queued mutation', next.path, err.message);
    }
    outbox.shift();
    delivered += 1;
  }
  return { delivered, pending: outbox.length };
}

export function setOffline(value) {
  offline = value;
  return value ? Promise.resolve({ delivered: 0, pending: outbox.length }) : flushOutbox();
}

export const pendingMutations = () => outbox.length;

/* -------------------------------- API ---------------------------------- */

export const cloudApi = {
  health: async () => {
    const data = await request('GET', '/api/health', null, { timeoutMs: 6000 });
    if (data.status !== 'ok') throw new ApiError(502, 'Unexpected health payload');
    return data;
  },
  getRoster: (siteId) => request('GET', `${site(siteId)}/roster`),
  getAudit: (siteId, { verify = false, limit = 100 } = {}) =>
    request('GET', `${site(siteId)}/audit?limit=${limit}${verify ? '&verify=1' : ''}`),
  requestIntervention: (siteId, conditions, { forceRefresh = false } = {}) =>
    request('POST', `${site(siteId)}/interventions`, { conditions, forceRefresh }, { timeoutMs: 12000 }),
  getIntervention: (siteId, interventionId) =>
    request('GET', `${site(siteId)}/interventions/${encodeURIComponent(interventionId)}`),
  decide: (siteId, interventionId, body) =>
    mutate('POST', `${site(siteId)}/interventions/${encodeURIComponent(interventionId)}/decision`, body),
  workerEvent: (siteId, workerId, body) =>
    mutate('POST', `${site(siteId)}/workers/${encodeURIComponent(workerId)}/events`, body),
  nudge: (siteId, body) => mutate('POST', `${site(siteId)}/nudge`, body),
};
