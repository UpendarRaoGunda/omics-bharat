import { PRODUCT_PLANS, assertCommercialConfiguration, getCommercialConfig } from './config.js';
import { getCommercialStore } from './store.js';
import {
  apiKeyPrefix,
  authenticateRequest,
  createApiKeySecret,
  ensureBootstrapIdentity,
  hashApiKey,
  loginDemo,
  loginWithPassword,
  permissionsForRole,
  publicUser,
  requirePermission,
  resolveOrganization
} from './auth.js';
import { evaluateDatasetQuality, qualityFramework } from './quality.js';
import { harmonizationCapabilities, harmonizeRecord } from './harmonize.js';
import { createRunManifest, dispatchRun, findWorkflow, workflowRegistry } from './workflows.js';
import { createEvidencePackage } from './reports.js';
import { getResources } from '../catalog.js';
import { methodNotAllowed, readJsonBody, sendJson } from '../http.js';

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function notFound(message = 'Resource not found.') {
  const error = new Error(message);
  error.statusCode = 404;
  throw error;
}

function conflict(message) {
  const error = new Error(message);
  error.statusCode = 409;
  throw error;
}

function planFor(id) {
  return PRODUCT_PLANS.find((plan) => plan.id === id) || PRODUCT_PLANS[0];
}

function enforceLimit(plan, key, current) {
  const limit = plan.limits[key];
  if (limit === -1 || current < limit) return;
  const error = new Error(`${plan.name} plan limit reached for ${key}.`);
  error.statusCode = 402;
  throw error;
}

function safeName(value, label, maximum = 120) {
  const result = String(value || '').trim();
  if (!result) badRequest(`${label} is required.`);
  if (result.length > maximum) badRequest(`${label} must be ${maximum} characters or fewer.`);
  return result;
}

function safeOptional(value, maximum = 2_000) {
  const result = String(value || '').trim();
  if (result.length > maximum) badRequest(`Text fields must be ${maximum} characters or fewer.`);
  return result;
}

function sanitizeApiKey(record) {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    prefix: record.prefix,
    role: record.role,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt || null,
    expiresAt: record.expiresAt || null,
    revokedAt: record.revokedAt || null
  };
}

async function requireContext(req, store, config, permission) {
  const auth = await authenticateRequest(req, store, config);
  if (!auth) {
    const error = new Error('Authentication is required.');
    error.statusCode = 401;
    throw error;
  }
  const organization = await resolveOrganization(req, auth, store);
  if (!organization) {
    const error = new Error('No accessible organization was found.');
    error.statusCode = 403;
    throw error;
  }
  const membership = await store.membership(auth.user.id, organization.id);
  const role = auth.role || membership?.role;
  if (!role) {
    const error = new Error('Organization membership is required.');
    error.statusCode = 403;
    throw error;
  }
  if (permission) requirePermission(role, permission);
  return { auth, organization, role, plan: planFor(organization.plan) };
}

async function assertProject(store, projectId, organizationId) {
  const project = await store.get('projects', projectId);
  if (!project || project.organizationId !== organizationId) notFound('Project not found.');
  return project;
}

function commercialStatus(config) {
  return {
    product: 'Omics Bharat Enterprise Preview',
    version: '3.0.0',
    enabled: config.enabled,
    mode: config.mode,
    demoEnabled: config.demoEnabled,
    persistence: config.dataDir ? 'encrypted-host-volume-ready file adapter' : 'ephemeral in-memory adapter',
    workflowExecutor: config.workflowExecutor,
    deploymentRegion: config.deploymentRegion,
    researchUseOnly: true,
    certifications: [],
    certificationClaim: 'No certification or regulatory compliance is claimed by this code release.',
    privateHumanDataAccepted: config.allowPrivateHumanData,
    capabilities: [
      'multi-tenant organizations and role-based permissions',
      'projects and saved evidence searches',
      'transparent dataset quality profiles',
      'provenance-preserving harmonization',
      'reproducible workflow manifests and executor webhook boundary',
      'decision-ready evidence packages',
      'API keys and organization-scoped audit events'
    ]
  };
}

export async function routeCommercialApi(req, res, url, pathname, requestId) {
  if (!pathname.startsWith('/api/v1/')) return false;

  const config = getCommercialConfig();
  if (!config.enabled) {
    sendJson(res, 503, { error: 'commercial_mode_disabled', message: 'Commercial workspace features are disabled on this deployment.', requestId });
    return true;
  }
  assertCommercialConfiguration(config);
  const store = await getCommercialStore(config);
  await ensureBootstrapIdentity(store, config);

  if (pathname === '/api/v1/status') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    sendJson(res, 200, commercialStatus(config));
    return true;
  }

  if (pathname === '/api/v1/plans') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    sendJson(res, 200, { plans: PRODUCT_PLANS, note: 'Published limits are product defaults, not a binding commercial quotation.' });
    return true;
  }

  if (pathname === '/api/v1/workflows') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    sendJson(res, 200, { workflows: workflowRegistry(), execution: config.workflowExecutor });
    return true;
  }

  const workflowMatch = pathname.match(/^\/api\/v1\/workflows\/([^/]+)$/);
  if (workflowMatch) {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const workflow = findWorkflow(workflowMatch[1]);
    if (!workflow) notFound('Workflow not found.');
    sendJson(res, 200, workflow);
    return true;
  }

  if (pathname === '/api/v1/quality/framework') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    sendJson(res, 200, qualityFramework());
    return true;
  }

  if (pathname === '/api/v1/harmonization/capabilities') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    sendJson(res, 200, harmonizationCapabilities());
    return true;
  }

  if (pathname === '/api/v1/openapi') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    sendJson(res, 200, commercialOpenApi());
    return true;
  }

  if (pathname === '/api/v1/auth/demo') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const session = await loginDemo(store, config);
    if (!session) {
      sendJson(res, 403, { error: 'demo_disabled', message: 'Demo access is disabled.', requestId });
      return true;
    }
    await store.audit({
      organizationId: session.organizations[0]?.id,
      actorId: session.user.id,
      action: 'session.demo_started',
      resourceType: 'session',
      resourceId: session.user.id,
      requestId
    });
    sendJson(res, 200, { ...session, expiresInSeconds: config.sessionTtlSeconds, warning: 'Demo storage is ephemeral. Do not enter confidential, identifiable, restricted or unpublished data.' });
    return true;
  }

  if (pathname === '/api/v1/auth/login') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const body = await readJsonBody(req, 64 * 1024);
    const session = await loginWithPassword(store, config, body.email, body.password);
    if (!session) {
      sendJson(res, 401, { error: 'invalid_credentials', message: 'Email or password is incorrect.', requestId });
      return true;
    }
    await store.audit({
      organizationId: session.organizations[0]?.id,
      actorId: session.user.id,
      action: 'session.login',
      resourceType: 'session',
      resourceId: session.user.id,
      requestId
    });
    sendJson(res, 200, { ...session, expiresInSeconds: config.sessionTtlSeconds });
    return true;
  }

  if (pathname === '/api/v1/me') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const auth = await authenticateRequest(req, store, config);
    if (!auth) {
      sendJson(res, 401, { error: 'unauthorized', message: 'Authentication is required.', requestId });
      return true;
    }
    const organizations = await store.organizationsForUser(auth.user.id);
    sendJson(res, 200, { user: publicUser(auth.user), organizations, permissions: Object.fromEntries(organizations.map((item) => [item.id, permissionsForRole(item.role)])) });
    return true;
  }

  if (pathname === '/api/v1/organizations') {
    const auth = await authenticateRequest(req, store, config);
    if (!auth) {
      sendJson(res, 401, { error: 'unauthorized', message: 'Authentication is required.', requestId });
      return true;
    }
    if (req.method === 'GET') {
      sendJson(res, 200, { organizations: await store.organizationsForUser(auth.user.id) });
      return true;
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req, 128 * 1024);
      const name = safeName(body.name, 'name');
      const slug = String(body.slug || name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
      if (!slug) badRequest('A valid organization slug is required.');
      if (await store.find('organizations', (item) => item.slug === slug)) conflict('Organization slug already exists.');
      const organization = await store.insert('organizations', {
        name,
        slug,
        plan: PRODUCT_PLANS.some((item) => item.id === body.plan) ? body.plan : 'research-team',
        dataClassification: body.dataClassification || 'organization-controlled'
      }, { idPrefix: 'org' });
      await store.insert('memberships', { userId: auth.user.id, organizationId: organization.id, role: 'owner' }, { idPrefix: 'mem' });
      await store.audit({ organizationId: organization.id, actorId: auth.user.id, action: 'organization.created', resourceType: 'organization', resourceId: organization.id, requestId });
      sendJson(res, 201, organization);
      return true;
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  if (pathname === '/api/v1/projects') {
    const context = await requireContext(req, store, config, req.method === 'GET' ? 'project.read' : 'project.write');
    if (req.method === 'GET') {
      const projects = await store.list('projects', (item) => item.organizationId === context.organization.id);
      sendJson(res, 200, { projects });
      return true;
    }
    if (req.method === 'POST') {
      const existing = await store.list('projects', (item) => item.organizationId === context.organization.id);
      enforceLimit(context.plan, 'projects', existing.length);
      const body = await readJsonBody(req, 256 * 1024);
      const project = await store.insert('projects', {
        organizationId: context.organization.id,
        name: safeName(body.name, 'name'),
        description: safeOptional(body.description),
        status: body.status || 'active',
        researchUseOnly: body.researchUseOnly !== false,
        createdBy: context.auth.user.id
      }, { idPrefix: 'prj' });
      await store.audit({ organizationId: context.organization.id, actorId: context.auth.user.id, action: 'project.created', resourceType: 'project', resourceId: project.id, detail: { name: project.name }, requestId });
      sendJson(res, 201, project);
      return true;
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  const projectMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)$/);
  if (projectMatch) {
    const context = await requireContext(req, store, config, 'project.read');
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    sendJson(res, 200, await assertProject(store, projectMatch[1], context.organization.id));
    return true;
  }

  if (pathname === '/api/v1/saved-searches') {
    const context = await requireContext(req, store, config, req.method === 'GET' ? 'search.read' : 'search.write');
    if (req.method === 'GET') {
      const searches = await store.list('savedSearches', (item) => item.organizationId === context.organization.id);
      sendJson(res, 200, { savedSearches: searches });
      return true;
    }
    if (req.method === 'POST') {
      const existing = await store.list('savedSearches', (item) => item.organizationId === context.organization.id);
      enforceLimit(context.plan, 'savedSearches', existing.length);
      const body = await readJsonBody(req, 128 * 1024);
      if (body.projectId) await assertProject(store, body.projectId, context.organization.id);
      const search = await store.insert('savedSearches', {
        organizationId: context.organization.id,
        projectId: body.projectId || null,
        name: safeName(body.name, 'name'),
        query: safeName(body.query, 'query', 500),
        source: body.source || 'catalog',
        filters: body.filters || {},
        alertCadence: body.alertCadence || 'manual',
        createdBy: context.auth.user.id
      }, { idPrefix: 'search' });
      await store.audit({ organizationId: context.organization.id, actorId: context.auth.user.id, action: 'saved_search.created', resourceType: 'saved-search', resourceId: search.id, detail: { query: search.query }, requestId });
      sendJson(res, 201, search);
      return true;
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  const searchMatch = pathname.match(/^\/api\/v1\/saved-searches\/([^/]+)$/);
  if (searchMatch) {
    const context = await requireContext(req, store, config, 'search.write');
    if (req.method !== 'DELETE') return methodNotAllowed(res, ['DELETE']);
    const search = await store.get('savedSearches', searchMatch[1]);
    if (!search || search.organizationId !== context.organization.id) notFound('Saved search not found.');
    await store.remove('savedSearches', search.id);
    await store.audit({ organizationId: context.organization.id, actorId: context.auth.user.id, action: 'saved_search.deleted', resourceType: 'saved-search', resourceId: search.id, requestId });
    res.writeHead(204);
    res.end();
    return true;
  }

  if (pathname === '/api/v1/quality/evaluate') {
    const context = await requireContext(req, store, config, 'quality.evaluate');
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const body = await readJsonBody(req, 512 * 1024);
    if (body.projectId) await assertProject(store, body.projectId, context.organization.id);
    const result = evaluateDatasetQuality(body.metadata || body);
    let profile = null;
    if (body.persist === true) {
      profile = await store.insert('qualityProfiles', {
        organizationId: context.organization.id,
        projectId: body.projectId || null,
        resourceId: body.resourceId || null,
        datasetLabel: body.datasetLabel || body.metadata?.title || 'Untitled dataset',
        result,
        createdBy: context.auth.user.id
      }, { idPrefix: 'quality' });
      await store.audit({ organizationId: context.organization.id, actorId: context.auth.user.id, action: 'quality_profile.created', resourceType: 'quality-profile', resourceId: profile.id, detail: { score: result.score, grade: result.grade }, requestId });
    }
    sendJson(res, 200, { result, profile });
    return true;
  }

  if (pathname === '/api/v1/harmonize') {
    const context = await requireContext(req, store, config, 'harmonize.run');
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const body = await readJsonBody(req, 512 * 1024);
    const result = harmonizeRecord(body.record || body, { fields: body.fields, customMappings: body.customMappings });
    await store.audit({ organizationId: context.organization.id, actorId: context.auth.user.id, action: 'harmonization.executed', resourceType: 'metadata-record', resourceId: body.recordId || 'transient', detail: { reviewRequired: result.reviewRequired, unmappedFields: result.unmappedFields }, requestId });
    sendJson(res, 200, { result, retention: 'Input was processed transiently unless the caller explicitly stores it in an approved project system.' });
    return true;
  }

  if (pathname === '/api/v1/runs') {
    const context = await requireContext(req, store, config, req.method === 'GET' ? 'run.read' : 'run.write');
    if (req.method === 'GET') {
      const runs = await store.list('runs', (item) => item.organizationId === context.organization.id);
      sendJson(res, 200, { runs });
      return true;
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req, 1024 * 1024);
      await assertProject(store, body.projectId, context.organization.id);
      const recentRuns = await store.list('runs', (item) => item.organizationId === context.organization.id && item.createdAt >= new Date(Date.now() - 30 * 86400_000).toISOString());
      enforceLimit(context.plan, 'monthlyRuns', recentRuns.length);
      const manifest = createRunManifest(body, {
        organizationId: context.organization.id,
        userId: context.auth.user.id,
        allowPrivateHumanData: config.allowPrivateHumanData,
        executor: config.workflowExecutor,
        deploymentRegion: config.deploymentRegion
      });
      const dispatch = body.dispatch === true ? await dispatchRun(manifest, config) : { status: manifest.status, dispatched: false };
      const run = await store.insert('runs', {
        ...manifest,
        status: dispatch.status,
        dispatch
      }, { idPrefix: 'run' });
      await store.audit({ organizationId: context.organization.id, actorId: context.auth.user.id, action: dispatch.dispatched ? 'run.submitted' : 'run.manifest_created', resourceType: 'workflow-run', resourceId: run.id, detail: { workflowId: manifest.workflow.id, checksum: manifest.checksum, status: run.status }, requestId });
      sendJson(res, 201, run);
      return true;
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  const runMatch = pathname.match(/^\/api\/v1\/runs\/([^/]+)$/);
  if (runMatch) {
    const context = await requireContext(req, store, config, 'run.read');
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const run = await store.get('runs', runMatch[1]);
    if (!run || run.organizationId !== context.organization.id) notFound('Run not found.');
    sendJson(res, 200, run);
    return true;
  }

  if (pathname === '/api/v1/reports') {
    const context = await requireContext(req, store, config, req.method === 'GET' ? 'report.read' : 'report.write');
    if (req.method === 'GET') {
      const reports = await store.list('reports', (item) => item.organizationId === context.organization.id);
      sendJson(res, 200, { reports });
      return true;
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req, 1024 * 1024);
      await assertProject(store, body.projectId, context.organization.id);
      const catalog = await getResources();
      const wanted = new Set(Array.isArray(body.resourceIds) ? body.resourceIds : []);
      const selected = catalog.filter((item) => wanted.has(item.id));
      const qualityProfiles = await store.list('qualityProfiles', (item) => item.organizationId === context.organization.id && (!body.projectId || item.projectId === body.projectId));
      const report = createEvidencePackage(body, {
        organizationId: context.organization.id,
        userId: context.auth.user.id,
        resources: selected,
        qualityProfiles,
        catalogSnapshotAt: new Date().toISOString()
      });
      const saved = await store.insert('reports', report, { idPrefix: 'report' });
      await store.audit({ organizationId: context.organization.id, actorId: context.auth.user.id, action: 'evidence_report.created', resourceType: 'evidence-report', resourceId: saved.id, detail: { checksum: saved.checksum, sourceCount: saved.evidence.length, status: saved.decisionReadiness.status }, requestId });
      sendJson(res, 201, saved);
      return true;
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  const reportMatch = pathname.match(/^\/api\/v1\/reports\/([^/]+)$/);
  if (reportMatch) {
    const context = await requireContext(req, store, config, 'report.read');
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const report = await store.get('reports', reportMatch[1]);
    if (!report || report.organizationId !== context.organization.id) notFound('Report not found.');
    sendJson(res, 200, report);
    return true;
  }

  if (pathname === '/api/v1/audit') {
    const context = await requireContext(req, store, config, 'audit.read');
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit'), 10) || 100, 1), 500);
    const events = await store.list('auditEvents', (item) => item.organizationId === context.organization.id);
    events.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    sendJson(res, 200, { events: events.slice(0, limit), total: events.length, exportGeneratedAt: new Date().toISOString() });
    return true;
  }

  if (pathname === '/api/v1/api-keys') {
    const context = await requireContext(req, store, config, req.method === 'GET' ? 'apikey.read' : 'apikey.write');
    if (req.method === 'GET') {
      const keys = await store.list('apiKeys', (item) => item.organizationId === context.organization.id);
      sendJson(res, 200, { apiKeys: keys.map(sanitizeApiKey) });
      return true;
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req, 128 * 1024);
      const secret = createApiKeySecret();
      const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
      const record = await store.insert('apiKeys', {
        organizationId: context.organization.id,
        userId: context.auth.user.id,
        name: safeName(body.name, 'name'),
        prefix: apiKeyPrefix(secret),
        hash: hashApiKey(secret),
        role: ['scientist', 'reviewer', 'viewer'].includes(body.role) ? body.role : 'scientist',
        expiresAt
      }, { idPrefix: 'key' });
      await store.audit({ organizationId: context.organization.id, actorId: context.auth.user.id, action: 'api_key.created', resourceType: 'api-key', resourceId: record.id, detail: { name: record.name, role: record.role, prefix: record.prefix }, requestId });
      sendJson(res, 201, { apiKey: sanitizeApiKey(record), secret, warning: 'This secret is shown once. Store it in a secrets manager.' });
      return true;
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  const keyMatch = pathname.match(/^\/api\/v1\/api-keys\/([^/]+)$/);
  if (keyMatch) {
    const context = await requireContext(req, store, config, 'apikey.write');
    if (req.method !== 'DELETE') return methodNotAllowed(res, ['DELETE']);
    const key = await store.get('apiKeys', keyMatch[1]);
    if (!key || key.organizationId !== context.organization.id) notFound('API key not found.');
    await store.update('apiKeys', key.id, { revokedAt: new Date().toISOString() });
    await store.audit({ organizationId: context.organization.id, actorId: context.auth.user.id, action: 'api_key.revoked', resourceType: 'api-key', resourceId: key.id, detail: { prefix: key.prefix }, requestId });
    res.writeHead(204);
    res.end();
    return true;
  }

  sendJson(res, 404, { error: 'not_found', message: 'Commercial API endpoint not found.', requestId });
  return true;
}

function commercialOpenApi() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Omics Bharat Commercial API',
      version: '3.0.0',
      description: 'Research-use multi-tenant workspace APIs. This specification does not claim clinical or regulatory validation.'
    },
    servers: [{ url: '/api/v1' }],
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    paths: {
      '/status': { get: { security: [], summary: 'Commercial feature status' } },
      '/plans': { get: { security: [], summary: 'Product tiers and default limits' } },
      '/workflows': { get: { security: [], summary: 'Curated workflow registry' } },
      '/auth/demo': { post: { security: [], summary: 'Start a non-sensitive public demo session' } },
      '/auth/login': { post: { security: [], summary: 'Create a signed session' } },
      '/me': { get: { summary: 'Current user and organization memberships' } },
      '/organizations': { get: { summary: 'List organizations' }, post: { summary: 'Create organization' } },
      '/projects': { get: { summary: 'List projects' }, post: { summary: 'Create project' } },
      '/saved-searches': { get: { summary: 'List saved searches' }, post: { summary: 'Save an evidence search' } },
      '/quality/evaluate': { post: { summary: 'Generate a transparent dataset quality profile' } },
      '/harmonize': { post: { summary: 'Normalize metadata while preserving original values' } },
      '/runs': { get: { summary: 'List workflow runs' }, post: { summary: 'Create a reproducible run manifest' } },
      '/reports': { get: { summary: 'List evidence packages' }, post: { summary: 'Generate a decision-ready evidence package' } },
      '/audit': { get: { summary: 'Export organization audit events' } },
      '/api-keys': { get: { summary: 'List API keys' }, post: { summary: 'Create an API key' } }
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
        apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' }
      }
    }
  };
}
