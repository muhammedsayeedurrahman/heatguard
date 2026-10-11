/**
 * HeatGuard persistence: Amazon DynamoDB single-table design, with an in-memory twin
 * implementing the same interface for offline/local runs.
 *
 * Single-table layout (PK = SITE#<siteId>):
 *   SK = WORKER#<workerId>         worker roster row (status, ack time, hydration, SOS flag)
 *   SK = AUDIT#<seq, 10 digits>    immutable, hash-chained audit entry
 *   SK = AUDIT_HEAD                ledger head (seq + hash) - optimistic-concurrency anchor
 *   SK = EVENTID#<eventId>         idempotency marker -> seq (duplicate client retries are no-ops)
 *   SK = INTERVENTION#<id>         intervention record (conditions, physics facts, plan, decision)
 *   SK = PLANCACHE#<signature>     TTL'd pointer deduplicating Bedrock calls for identical risk states
 *   SK = RISK_STATE                last risk level seen by the scheduled HeatMonitor
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { INITIAL_WORKERS } from '../core/sites.js';
import { getConfig, resolveServiceModes } from './config.js';
import { GENESIS_HASH, sealEntry, verifyChain } from './ledger.js';
import { HttpError } from './http.js';

const pk = (siteId) => `SITE#${siteId}`;
const auditSk = (seq) => `AUDIT#${String(seq).padStart(10, '0')}`;
const nowIso = () => new Date().toISOString();
const epochSeconds = () => Math.floor(Date.now() / 1000);

function stripKeys(item) {
  if (!item) return item;
  const { PK: _pk, SK: _sk, entity: _entity, ...rest } = item;
  return rest;
}

/* ------------------------------------------------------------------------ */
/* DynamoDB implementation                                                   */
/* ------------------------------------------------------------------------ */

class DynamoStore {
  constructor(tableName, region) {
    this.kind = 'dynamodb';
    this.tableName = tableName;
    this.doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async getRoster(siteId) {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': pk(siteId), ':prefix': 'WORKER#' },
      })
    );
    if (result.Items?.length) return result.Items.map(stripKeys);
    return this.seedRoster(siteId);
  }

  async seedRoster(siteId) {
    const workers = INITIAL_WORKERS[siteId] || [];
    const updatedAt = nowIso();
    for (let i = 0; i < workers.length; i += 25) {
      await this.doc.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: workers.slice(i, i + 25).map((worker) => ({
              PutRequest: {
                Item: { PK: pk(siteId), SK: `WORKER#${worker.id}`, entity: 'Worker', ...worker, updatedAt },
              },
            })),
          },
        })
      );
    }
    return workers.map((worker) => ({ ...worker, updatedAt }));
  }

  /** set: attributes to overwrite; increment: numeric attributes to add to. */
  async updateWorker(siteId, workerId, { set = {}, increment = {} }) {
    const names = {};
    const values = { ':updatedAt': nowIso() };
    const setParts = ['#updatedAt = :updatedAt'];
    names['#updatedAt'] = 'updatedAt';
    Object.entries(set).forEach(([key, value], i) => {
      names[`#s${i}`] = key;
      values[`:s${i}`] = value;
      setParts.push(`#s${i} = :s${i}`);
    });
    const addParts = Object.entries(increment).map(([key, value], i) => {
      names[`#a${i}`] = key;
      values[`:a${i}`] = value;
      return `#a${i} :a${i}`;
    });
    const expression = `SET ${setParts.join(', ')}${addParts.length ? ` ADD ${addParts.join(', ')}` : ''}`;

    try {
      const result = await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: pk(siteId), SK: `WORKER#${workerId}` },
          UpdateExpression: expression,
          ConditionExpression: 'attribute_exists(PK)',
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: 'ALL_NEW',
        })
      );
      return stripKeys(result.Attributes);
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        throw new HttpError(404, `Unknown worker "${workerId}" at site "${siteId}"`);
      }
      throw err;
    }
  }

  async getItem(siteId, sk) {
    const result = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { PK: pk(siteId), SK: sk }, ConsistentRead: true })
    );
    return result.Item || null;
  }

  /**
   * Appends to the site's hash chain with optimistic concurrency: the head update, the new
   * entry and the idempotency marker commit atomically, or not at all.
   */
  async appendAudit(siteId, entry) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const head = await this.getItem(siteId, 'AUDIT_HEAD');
      const prevSeq = head?.seq ?? 0;
      const sealed = sealEntry(head?.headHash ?? GENESIS_HASH, prevSeq + 1, { ...entry, siteId, ts: entry.ts || nowIso() });

      try {
        await this.doc.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: this.tableName,
                  Key: { PK: pk(siteId), SK: 'AUDIT_HEAD' },
                  UpdateExpression: 'SET seq = :seq, headHash = :hash, updatedAt = :ts',
                  ConditionExpression: head ? 'seq = :prevSeq' : 'attribute_not_exists(PK)',
                  ExpressionAttributeValues: {
                    ':seq': sealed.seq,
                    ':hash': sealed.hash,
                    ':ts': sealed.ts,
                    ...(head ? { ':prevSeq': prevSeq } : {}),
                  },
                },
              },
              {
                Put: {
                  TableName: this.tableName,
                  Item: { PK: pk(siteId), SK: auditSk(sealed.seq), entity: 'AuditEntry', ...sealed },
                  ConditionExpression: 'attribute_not_exists(PK)',
                },
              },
              {
                Put: {
                  TableName: this.tableName,
                  Item: { PK: pk(siteId), SK: `EVENTID#${sealed.id}`, entity: 'EventId', seq: sealed.seq },
                  ConditionExpression: 'attribute_not_exists(PK)',
                },
              },
            ],
          })
        );
        return { entry: sealed, duplicate: false };
      } catch (err) {
        if (err.name !== 'TransactionCanceledException') throw err;
        const reasons = err.CancellationReasons || [];
        if (reasons[2]?.Code === 'ConditionalCheckFailed') {
          // Same event ID already recorded: return the original entry (idempotent retry).
          const marker = await this.getItem(siteId, `EVENTID#${entry.id}`);
          const original = marker ? await this.getItem(siteId, auditSk(marker.seq)) : null;
          return { entry: stripKeys(original), duplicate: true };
        }
        // Head moved under us (concurrent append) - back off and retry with the new head.
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1) + Math.random() * 50));
      }
    }
    throw new Error('Audit ledger contention: could not append after 6 attempts');
  }

  async listAudit(siteId, { limit = 100, ascending = false } = {}) {
    const items = [];
    let ExclusiveStartKey;
    do {
      const result = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': pk(siteId), ':prefix': 'AUDIT#' },
          ScanIndexForward: ascending,
          Limit: limit ? Math.min(limit - items.length, 500) : 500,
          ExclusiveStartKey,
        })
      );
      items.push(...(result.Items || []).map(stripKeys));
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey && (!limit || items.length < limit));
    return items;
  }

  async verifyAudit(siteId) {
    return verifyChain(await this.listAudit(siteId, { limit: 0, ascending: true }));
  }

  async getAuditHead(siteId) {
    const head = await this.getItem(siteId, 'AUDIT_HEAD');
    return head ? { seq: head.seq, headHash: head.headHash, updatedAt: head.updatedAt } : null;
  }

  async hasAuditEvent(siteId, eventId) {
    return Boolean(await this.getItem(siteId, `EVENTID#${eventId}`));
  }

  async putIntervention(siteId, record) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { PK: pk(siteId), SK: `INTERVENTION#${record.id}`, entity: 'Intervention', ...record },
      })
    );
    return record;
  }

  async getIntervention(siteId, interventionId) {
    return stripKeys(await this.getItem(siteId, `INTERVENTION#${interventionId}`));
  }

  async updateIntervention(siteId, interventionId, fields) {
    const entries = Object.entries({ ...fields, updatedAt: nowIso() });
    const result = await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: pk(siteId), SK: `INTERVENTION#${interventionId}` },
        UpdateExpression: `SET ${entries.map((_, i) => `#f${i} = :f${i}`).join(', ')}`,
        ConditionExpression: 'attribute_exists(PK)',
        ExpressionAttributeNames: Object.fromEntries(entries.map(([key], i) => [`#f${i}`, key])),
        ExpressionAttributeValues: Object.fromEntries(entries.map(([, value], i) => [`:f${i}`, value])),
        ReturnValues: 'ALL_NEW',
      })
    );
    return stripKeys(result.Attributes);
  }

  /**
   * Claims the plan-cache slot for a risk signature. Returns the existing intervention ID
   * when an unexpired plan (ready or still synthesizing) already covers this signature.
   */
  async claimPlanCache(siteId, signature, interventionId, ttlSeconds, { force = false } = {}) {
    const now = epochSeconds();
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: pk(siteId),
            SK: `PLANCACHE#${signature}`,
            entity: 'PlanCache',
            interventionId,
            expiresAt: now + ttlSeconds,
          },
          ...(force
            ? {}
            : {
                ConditionExpression: 'attribute_not_exists(PK) OR expiresAt < :now',
                ExpressionAttributeValues: { ':now': now },
              }),
        })
      );
      return { claimed: true };
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') throw err;
      const existing = await this.getItem(siteId, `PLANCACHE#${signature}`);
      return { claimed: false, interventionId: existing?.interventionId };
    }
  }

  async releasePlanCache(siteId, signature) {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: pk(siteId), SK: `PLANCACHE#${signature}` },
        UpdateExpression: 'SET expiresAt = :zero',
        ExpressionAttributeValues: { ':zero': 0 },
      })
    );
  }

  async getRiskState(siteId) {
    return stripKeys(await this.getItem(siteId, 'RISK_STATE'));
  }

  async putRiskState(siteId, state) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { PK: pk(siteId), SK: 'RISK_STATE', entity: 'RiskState', ...state },
      })
    );
  }

  /** System-wide status records (PK = SYSTEM), e.g. the last Bedrock call outcome for /api/health. */
  async putStatus(name, value) {
    await this.doc.send(
      new PutCommand({ TableName: this.tableName, Item: { PK: 'SYSTEM', SK: `STATUS#${name}`, entity: 'Status', ...value } })
    );
  }

  async getStatus(name) {
    const result = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { PK: 'SYSTEM', SK: `STATUS#${name}` } })
    );
    return stripKeys(result.Item || null);
  }
}

/* ------------------------------------------------------------------------ */
/* In-memory implementation (offline / no AWS credentials)                   */
/* ------------------------------------------------------------------------ */

const clone = (value) => (value === undefined ? value : structuredClone(value));

class MemoryStore {
  constructor() {
    this.kind = 'memory';
    this.rosters = new Map();
    this.ledgers = new Map(); // siteId -> { entries: [], ids: Map(eventId -> seq) }
    this.interventions = new Map();
    this.planCache = new Map();
    this.riskStates = new Map();
    this.statuses = new Map();
  }

  async getRoster(siteId) {
    if (!this.rosters.has(siteId)) {
      const updatedAt = nowIso();
      this.rosters.set(siteId, (INITIAL_WORKERS[siteId] || []).map((w) => ({ ...w, updatedAt })));
    }
    return clone(this.rosters.get(siteId));
  }

  async updateWorker(siteId, workerId, { set = {}, increment = {} }) {
    await this.getRoster(siteId);
    const worker = this.rosters.get(siteId).find((w) => w.id === workerId);
    if (!worker) throw new HttpError(404, `Unknown worker "${workerId}" at site "${siteId}"`);
    Object.assign(worker, set, { updatedAt: nowIso() });
    Object.entries(increment).forEach(([key, value]) => {
      worker[key] = (worker[key] || 0) + value;
    });
    return clone(worker);
  }

  ledger(siteId) {
    if (!this.ledgers.has(siteId)) this.ledgers.set(siteId, { entries: [], ids: new Map() });
    return this.ledgers.get(siteId);
  }

  async appendAudit(siteId, entry) {
    const ledger = this.ledger(siteId);
    if (ledger.ids.has(entry.id)) {
      return { entry: clone(ledger.entries[ledger.ids.get(entry.id) - 1]), duplicate: true };
    }
    const prev = ledger.entries[ledger.entries.length - 1];
    const sealed = sealEntry(prev?.hash ?? GENESIS_HASH, ledger.entries.length + 1, {
      ...entry,
      siteId,
      ts: entry.ts || nowIso(),
    });
    ledger.entries.push(sealed);
    ledger.ids.set(sealed.id, sealed.seq);
    return { entry: clone(sealed), duplicate: false };
  }

  async listAudit(siteId, { limit = 100, ascending = false } = {}) {
    const entries = [...this.ledger(siteId).entries];
    if (!ascending) entries.reverse();
    return clone(limit ? entries.slice(0, limit) : entries);
  }

  async verifyAudit(siteId) {
    return verifyChain(this.ledger(siteId).entries);
  }

  async getAuditHead(siteId) {
    const last = this.ledger(siteId).entries.at(-1);
    return last ? { seq: last.seq, headHash: last.hash, updatedAt: last.ts } : null;
  }

  async hasAuditEvent(siteId, eventId) {
    return this.ledger(siteId).ids.has(eventId);
  }

  async putIntervention(siteId, record) {
    this.interventions.set(`${siteId}|${record.id}`, clone(record));
    return record;
  }

  async getIntervention(siteId, interventionId) {
    return clone(this.interventions.get(`${siteId}|${interventionId}`) || null);
  }

  async updateIntervention(siteId, interventionId, fields) {
    const key = `${siteId}|${interventionId}`;
    const record = this.interventions.get(key);
    if (!record) throw new HttpError(404, `Unknown intervention "${interventionId}"`);
    Object.assign(record, clone(fields), { updatedAt: nowIso() });
    return clone(record);
  }

  async claimPlanCache(siteId, signature, interventionId, ttlSeconds, { force = false } = {}) {
    const key = `${siteId}|${signature}`;
    const existing = this.planCache.get(key);
    if (!force && existing && existing.expiresAt > epochSeconds()) {
      return { claimed: false, interventionId: existing.interventionId };
    }
    this.planCache.set(key, { interventionId, expiresAt: epochSeconds() + ttlSeconds });
    return { claimed: true };
  }

  async releasePlanCache(siteId, signature) {
    this.planCache.delete(`${siteId}|${signature}`);
  }

  async getRiskState(siteId) {
    return clone(this.riskStates.get(siteId) || null);
  }

  async putRiskState(siteId, state) {
    this.riskStates.set(siteId, clone(state));
  }

  async putStatus(name, value) {
    this.statuses.set(name, clone(value));
  }

  async getStatus(name) {
    return clone(this.statuses.get(name) || null);
  }
}

let memoryStore = null;
let dynamoStore = null;

export async function getStore() {
  const modes = await resolveServiceModes();
  if (modes.dynamodb === 'live') {
    const config = getConfig();
    dynamoStore ??= new DynamoStore(config.tableName, config.region);
    return dynamoStore;
  }
  memoryStore ??= new MemoryStore();
  return memoryStore;
}
