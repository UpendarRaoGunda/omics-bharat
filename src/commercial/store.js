import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const COLLECTIONS = Object.freeze([
  'users',
  'organizations',
  'memberships',
  'projects',
  'savedSearches',
  'qualityProfiles',
  'runs',
  'reports',
  'apiKeys',
  'auditEvents'
]);

function emptyState() {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, []]));
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function demoSeed() {
  const now = new Date().toISOString();
  return {
    ...emptyState(),
    users: [{
      id: 'usr_demo_owner',
      email: 'demo@omicsbharat.local',
      name: 'Demo Research Lead',
      demo: true,
      active: true,
      createdAt: now,
      updatedAt: now
    }],
    organizations: [{
      id: 'org_demo',
      name: 'Omics Bharat Design Partner',
      slug: 'demo-design-partner',
      plan: 'enterprise',
      dataClassification: 'public-demo-only',
      createdAt: now,
      updatedAt: now
    }],
    memberships: [{
      id: 'mem_demo_owner',
      userId: 'usr_demo_owner',
      organizationId: 'org_demo',
      role: 'owner',
      createdAt: now,
      updatedAt: now
    }],
    projects: [{
      id: 'prj_demo_target',
      organizationId: 'org_demo',
      name: 'Target evidence pilot',
      description: 'A non-sensitive demonstration workspace for disease-to-evidence review.',
      status: 'active',
      researchUseOnly: true,
      createdBy: 'usr_demo_owner',
      createdAt: now,
      updatedAt: now
    }],
    savedSearches: [{
      id: 'search_demo_1',
      organizationId: 'org_demo',
      projectId: 'prj_demo_target',
      name: 'Oral cancer transcriptomics in India',
      query: 'oral cancer RNA-seq India',
      source: 'catalog',
      createdBy: 'usr_demo_owner',
      createdAt: now,
      updatedAt: now
    }],
    auditEvents: [{
      id: 'audit_demo_seed',
      organizationId: 'org_demo',
      actorId: 'system',
      action: 'workspace.seeded',
      resourceType: 'organization',
      resourceId: 'org_demo',
      detail: { mode: 'public-demo', note: 'No confidential or human participant data is permitted.' },
      createdAt: now
    }]
  };
}

function normaliseState(value) {
  const state = emptyState();
  for (const collection of COLLECTIONS) {
    if (Array.isArray(value?.[collection])) state[collection] = value[collection];
  }
  return state;
}

export class CommercialStore {
  constructor(config) {
    this.config = config;
    this.state = config.demoEnabled ? demoSeed() : emptyState();
    this.filePath = config.dataDir ? join(config.dataDir, 'commercial-store.json') : '';
    this.ready = this.#load();
    this.writeChain = Promise.resolve();
  }

  async #load() {
    if (!this.filePath) return;
    await mkdir(this.config.dataDir, { recursive: true });
    try {
      const persisted = JSON.parse(await readFile(this.filePath, 'utf8'));
      this.state = normaliseState(persisted);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.#persistNow();
    }
  }

  async #persistNow() {
    if (!this.filePath) return;
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  async persist() {
    if (!this.filePath) return;
    this.writeChain = this.writeChain.then(() => this.#persistNow());
    await this.writeChain;
  }

  async list(collection, predicate = () => true) {
    await this.ready;
    this.#assertCollection(collection);
    return clone(this.state[collection].filter(predicate));
  }

  async find(collection, predicate) {
    await this.ready;
    this.#assertCollection(collection);
    return clone(this.state[collection].find(predicate));
  }

  async get(collection, id) {
    return this.find(collection, (item) => item.id === id);
  }

  async insert(collection, record, { idPrefix } = {}) {
    await this.ready;
    this.#assertCollection(collection);
    const timestamp = new Date().toISOString();
    const id = record.id || `${idPrefix || collection.slice(0, 3)}_${randomUUID()}`;
    if (this.state[collection].some((item) => item.id === id)) {
      const error = new Error(`Duplicate ${collection} identifier.`);
      error.statusCode = 409;
      throw error;
    }
    const saved = { ...clone(record), id, createdAt: record.createdAt || timestamp, updatedAt: timestamp };
    this.state[collection].push(saved);
    await this.persist();
    return clone(saved);
  }

  async update(collection, id, patch) {
    await this.ready;
    this.#assertCollection(collection);
    const index = this.state[collection].findIndex((item) => item.id === id);
    if (index < 0) return null;
    const current = this.state[collection][index];
    const updated = {
      ...current,
      ...clone(patch),
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString()
    };
    this.state[collection][index] = updated;
    await this.persist();
    return clone(updated);
  }

  async remove(collection, id) {
    await this.ready;
    this.#assertCollection(collection);
    const index = this.state[collection].findIndex((item) => item.id === id);
    if (index < 0) return false;
    this.state[collection].splice(index, 1);
    await this.persist();
    return true;
  }

  async audit({ organizationId, actorId, action, resourceType, resourceId, detail = {}, requestId }) {
    return this.insert('auditEvents', {
      organizationId,
      actorId,
      action,
      resourceType,
      resourceId,
      detail: clone(detail),
      requestId,
      createdAt: new Date().toISOString()
    }, { idPrefix: 'audit' });
  }

  async membership(userId, organizationId) {
    return this.find('memberships', (item) => item.userId === userId && item.organizationId === organizationId);
  }

  async organizationsForUser(userId) {
    const memberships = await this.list('memberships', (item) => item.userId === userId);
    const allowed = new Map(memberships.map((membership) => [membership.organizationId, membership.role]));
    const organizations = await this.list('organizations', (item) => allowed.has(item.id));
    return organizations.map((organization) => ({ ...organization, role: allowed.get(organization.id) }));
  }

  snapshot() {
    return clone(this.state);
  }

  #assertCollection(collection) {
    if (!COLLECTIONS.includes(collection)) throw new TypeError(`Unknown commercial collection: ${collection}`);
  }
}

let storePromise;

export async function getCommercialStore(config) {
  storePromise ||= Promise.resolve(new CommercialStore(config));
  const store = await storePromise;
  await store.ready;
  return store;
}

export function resetCommercialStoreForTests() {
  storePromise = undefined;
}
