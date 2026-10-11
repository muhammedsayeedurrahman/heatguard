/**
 * Audit API (Lambda, HTTP API route, read-only IAM)
 *   GET /api/sites/{siteId}/audit?limit=100&verify=1
 * Returns newest-first ledger entries; verify=1 re-hashes the whole chain from genesis.
 */

import { clampNumber, createApiHandler, requireSite } from '../lib/http.js';
import { getStore } from '../lib/store.js';

async function getAudit({ params, query }) {
  const site = requireSite(params.siteId);
  const limit = query.limit ? clampNumber(query.limit, 1, 200, 'limit') : 100;
  const store = await getStore();
  const [entries, head, verification] = await Promise.all([
    store.listAudit(site.id, { limit }),
    store.getAuditHead(site.id),
    query.verify === '1' ? store.verifyAudit(site.id) : Promise.resolve(null),
  ]);
  return { siteId: site.id, ledger: store.kind, head, verification, entries };
}

export const handler = createApiHandler({
  'GET /api/sites/{siteId}/audit': getAudit,
});
