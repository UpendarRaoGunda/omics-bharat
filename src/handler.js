import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { catalogFacets, filterResources, getResources } from './catalog.js';
import { methodNotAllowed, readBody, readJsonBody, sendJson, serveStatic, setSecurityHeaders } from './http.js';
import { probePublicSources, searchEuropePmc, searchNcbi } from './live.js';
import { profileDelimited, summariseFasta, summariseVcf, validateMetadata } from './parsers.js';
import { checkRateLimit } from './rate-limit.js';
import { routeCommercialApi } from './commercial/router.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const publicRoot = join(currentDir, '..', 'public');
const startedAt = Date.now();

export async function handler(req, res) {
  const requestId = randomUUID();
  const requestStarted = Date.now();
  setSecurityHeaders(res);
  res.setHeader('X-Request-Id', requestId);

  try {
    const base = `http://${req.headers.host || 'localhost'}`;
    const url = new URL(req.url || '/', base);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith('/api/')) {
      const rate = checkRateLimit(req);
      res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(rate.resetAt / 1000)));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Organization-Id');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (!rate.allowed) {
        sendJson(res, 429, {
          error: 'rate_limited',
          message: 'Too many requests. Please retry after the rate-limit window resets.',
          requestId
        }, { 'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))) });
        return;
      }

      await routeApi(req, res, url, pathname, requestId);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      methodNotAllowed(res, ['GET', 'HEAD']);
      return;
    }

    const served = await serveStatic(res, publicRoot, pathname);
    if (!served && !pathname.includes('.')) {
      const fallback = pathname === '/enterprise' ? '/enterprise.html' : '/index.html';
      await serveStatic(res, publicRoot, fallback);
    } else if (!served) {
      sendJson(res, 404, { error: 'not_found', message: 'File not found.', requestId });
    }
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    const statusCode = Number(error.statusCode) || 500;
    const safeMessage = statusCode >= 500
      ? 'The request could not be completed. Please retry or check the service status.'
      : error.message;
    if (statusCode >= 500) {
      console.error(JSON.stringify({
        level: 'error',
        requestId,
        method: req.method,
        url: req.url,
        durationMs: Date.now() - requestStarted,
        error: error.message,
        stack: error.stack
      }));
    }
    sendJson(res, statusCode, {
      error: statusCode >= 500 ? 'service_error' : 'invalid_request',
      message: safeMessage,
      detail: statusCode === 502 || statusCode === 504 ? error.detail || error.message : undefined,
      requestId
    });
  }
}

async function routeApi(req, res, url, pathname, requestId) {
  if (await routeCommercialApi(req, res, url, pathname, requestId)) return;

  if (pathname === '/api/health') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    sendJson(res, 200, {
      status: 'ok',
      service: 'omics-bharat',
      version: '3.0.0',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      principles: [
        'free community access remains available',
        'commercial workspace is research-use only',
        'no uploaded sequence retention in community tools',
        'no unsupported certification or clinical claims'
      ]
    });
    return;
  }

  if (pathname === '/api/docs') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    sendJson(res, 200, apiDocumentation());
    return;
  }

  if (pathname === '/api/catalog') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const resources = await getResources();
    const filtered = filterResources(resources, Object.fromEntries(url.searchParams));
    const limit = clampInteger(url.searchParams.get('limit'), 1, 500, 250);
    const offset = clampInteger(url.searchParams.get('offset'), 0, Math.max(0, filtered.length), 0);
    sendJson(res, 200, {
      total: filtered.length,
      limit,
      offset,
      results: filtered.slice(offset, offset + limit),
      disclaimer: 'Catalog entries are external public resources. Inclusion does not imply partnership, endorsement or data hosting by Omics Bharat.'
    });
    return;
  }

  if (pathname.startsWith('/api/catalog/')) {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const id = pathname.slice('/api/catalog/'.length);
    const resources = await getResources();
    const resource = resources.find((item) => item.id === id);
    if (!resource) {
      sendJson(res, 404, { error: 'not_found', message: 'Catalog resource not found.', requestId });
      return;
    }
    sendJson(res, 200, resource);
    return;
  }

  if (pathname === '/api/facets') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const resources = await getResources();
    sendJson(res, 200, catalogFacets(resources));
    return;
  }

  if (pathname === '/api/stats') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const resources = await getResources();
    const indiaResources = resources.filter((item) => item.scope === 'India');
    const globalResources = resources.filter((item) => item.scope === 'Global');
    sendJson(res, 200, {
      curatedResources: resources.length,
      indiaFocusedResources: indiaResources.length,
      globalPublicResources: globalResources.length,
      omicsAreas: new Set(resources.flatMap((item) => item.omics || [])).size,
      categories: new Set(resources.map((item) => item.category)).size,
      apiEnabledResources: resources.filter((item) => item.api).length,
      openSourceResources: resources.filter((item) => item.openSource).length,
      analysisTools: 4,
      liveConnectors: 2,
      commercialWorkspaceModules: 8,
      generatedAt: new Date().toISOString(),
      note: 'Counts describe this catalog and its software capabilities, not hospitals, participants, samples, customers or national coverage.'
    });
    return;
  }

  if (pathname === '/api/live/status') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const sources = await probePublicSources();
    sendJson(res, 200, { checkedAt: new Date().toISOString(), sources });
    return;
  }

  if (pathname === '/api/live/publications') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const result = await searchEuropePmc({
      query: url.searchParams.get('q'),
      india: parseBoolean(url.searchParams.get('india'), true),
      limit: url.searchParams.get('limit')
    });
    sendJson(res, 200, result, { 'Cache-Control': 'public, max-age=120' });
    return;
  }

  if (pathname === '/api/live/studies') {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const result = await searchNcbi({
      source: url.searchParams.get('source') || 'geo',
      query: url.searchParams.get('q'),
      india: parseBoolean(url.searchParams.get('india'), true),
      limit: url.searchParams.get('limit')
    });
    sendJson(res, 200, result, { 'Cache-Control': 'public, max-age=120' });
    return;
  }

  if (pathname === '/api/tools/fasta-summary') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const body = await readBody(req);
    sendJson(res, 200, { result: summariseFasta(body), retention: 'Input was processed in memory and was not stored.' });
    return;
  }

  if (pathname === '/api/tools/vcf-summary') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const body = await readBody(req);
    sendJson(res, 200, { result: summariseVcf(body), retention: 'Input was processed in memory and was not stored.' });
    return;
  }

  if (pathname === '/api/tools/table-profile') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const body = await readBody(req);
    sendJson(res, 200, { result: profileDelimited(body), retention: 'Input was processed in memory and was not stored.' });
    return;
  }

  if (pathname === '/api/tools/metadata-check') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const body = await readJsonBody(req, 512 * 1024);
    sendJson(res, 200, { result: validateMetadata(body), retention: 'Metadata was processed in memory and was not stored.' });
    return;
  }

  sendJson(res, 404, { error: 'not_found', message: 'API endpoint not found.', requestId });
}

function parseBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function apiDocumentation() {
  return {
    name: 'Omics Bharat API',
    version: '3.0.0',
    basePath: '/api',
    retention: 'Community analysis endpoints process request bodies in memory and do not persist them. Commercial workspace persistence depends on deployment configuration.',
    endpoints: [
      { method: 'GET', path: '/api/health', description: 'Service health and uptime.' },
      { method: 'GET', path: '/api/catalog', query: ['query', 'kind', 'category', 'omics', 'scope', 'region', 'access', 'api', 'openSource', 'limit', 'offset'], description: 'Search the curated public-resource catalog.' },
      { method: 'GET', path: '/api/catalog/:id', description: 'Read one curated resource.' },
      { method: 'GET', path: '/api/facets', description: 'Catalog filter values and capability counts.' },
      { method: 'GET', path: '/api/stats', description: 'Honest platform counts based on the catalog and implemented modules.' },
      { method: 'GET', path: '/api/live/status', description: 'Check public connector availability.' },
      { method: 'GET', path: '/api/live/publications?q=diabetes&india=true', description: 'Search Europe PMC.' },
      { method: 'GET', path: '/api/live/studies?source=geo&q=oral+cancer&india=true', description: 'Search NCBI GEO, SRA or ClinVar through E-utilities.' },
      { method: 'POST', path: '/api/tools/fasta-summary', contentType: 'text/plain', description: 'FASTA structural summary.' },
      { method: 'POST', path: '/api/tools/vcf-summary', contentType: 'text/plain', description: 'VCF structural QC summary.' },
      { method: 'POST', path: '/api/tools/table-profile', contentType: 'text/plain', description: 'CSV/TSV profile.' },
      { method: 'POST', path: '/api/tools/metadata-check', contentType: 'application/json', description: 'Research metadata completeness and privacy checks.' },
      { method: 'GET', path: '/api/v1/status', description: 'Commercial workspace capabilities and deployment boundaries.' },
      { method: 'GET', path: '/api/v1/openapi', description: 'Commercial API OpenAPI document.' },
      { method: 'POST', path: '/api/v1/auth/demo', description: 'Start a non-sensitive demo workspace session when enabled.' },
      { method: 'GET/POST', path: '/api/v1/projects', description: 'Organization-scoped research projects.' },
      { method: 'POST', path: '/api/v1/quality/evaluate', description: 'Transparent dataset quality profile.' },
      { method: 'POST', path: '/api/v1/harmonize', description: 'Provenance-preserving metadata harmonization.' },
      { method: 'GET/POST', path: '/api/v1/runs', description: 'Reproducible workflow manifests and optional executor dispatch.' },
      { method: 'GET/POST', path: '/api/v1/reports', description: 'Decision-ready evidence packages.' },
      { method: 'GET', path: '/api/v1/audit', description: 'Organization audit-event export.' }
    ]
  };
}
