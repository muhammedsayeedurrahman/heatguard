/**
 * Tamper-evident audit ledger: every entry carries SHA-256(prevHash | canonical entry).
 * Editing or deleting any stored entry breaks verification from that point onward.
 */

import { createHash } from 'node:crypto';

export const GENESIS_HASH = '0'.repeat(64);

// Key-sorted serialization: DynamoDB does not preserve map key order across round trips.
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function canonical(entry) {
  return stableStringify([
    entry.seq,
    entry.id,
    entry.ts,
    entry.siteId,
    entry.type,
    entry.actor,
    entry.details,
    entry.severity,
    entry.meta ?? null,
  ]);
}

export function computeEntryHash(prevHash, entry) {
  return createHash('sha256').update(`${prevHash}|${canonical(entry)}`).digest('hex');
}

export function sealEntry(prevHash, seq, entry) {
  const sealed = { ...entry, seq, prevHash };
  sealed.hash = computeEntryHash(prevHash, sealed);
  return sealed;
}

/** Verifies entries sorted by ascending seq. */
export function verifyChain(entriesAscending) {
  let prevHash = GENESIS_HASH;
  for (const entry of entriesAscending) {
    if (entry.prevHash !== prevHash || computeEntryHash(prevHash, entry) !== entry.hash) {
      return { valid: false, length: entriesAscending.length, brokenAtSeq: entry.seq, headHash: null };
    }
    prevHash = entry.hash;
  }
  return { valid: true, length: entriesAscending.length, brokenAtSeq: null, headHash: prevHash };
}
