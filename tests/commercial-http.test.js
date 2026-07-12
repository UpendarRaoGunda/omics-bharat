import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handler } from '../src/handler.js';

async function withServer(run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function json(response) {
  const body = await response.json();
  assert.ok(response.ok, JSON.stringify(body));
  return body;
}

function headers(token, organizationId) {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
    'x-organization-id': organizationId
  };
}

test('commercial demo supports a governed evidence workflow', async () => {
  await withServer(async (base) => {
    const status = await json(await fetch(`${base}/api/v1/status`));
    assert.equal(status.version, '3.0.0');
    assert.equal(status.researchUseOnly, true);
    assert.equal(status.certifications.length, 0);

    const session = await json(await fetch(`${base}/api/v1/auth/demo`, { method: 'POST' }));
    assert.ok(session.token);
    const organizationId = session.organizations[0].id;
    const authHeaders = headers(session.token, organizationId);

    const me = await json(await fetch(`${base}/api/v1/me`, { headers: authHeaders }));
    assert.equal(me.user.demo, true);
    assert.equal(me.organizations[0].role, 'owner');

    const project = await json(await fetch(`${base}/api/v1/projects`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Commercial API test', description: 'Test workspace', researchUseOnly: true })
    }));
    assert.equal(project.organizationId, organizationId);

    const savedSearch = await json(await fetch(`${base}/api/v1/saved-searches`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'India transcriptomics', query: 'India RNA-seq', projectId: project.id, source: 'catalog' })
    }));
    assert.equal(savedSearch.projectId, project.id);

    const quality = await json(await fetch(`${base}/api/v1/quality/evaluate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId: project.id,
        persist: true,
        resourceId: 'ibdc',
        datasetLabel: 'Test dataset',
        metadata: { title: 'Test', accession: 'TEST1', disease: 'tuberculosis', tissue: 'blood', species: 'human', assay: 'RNA-seq', sampleSize: 10, humanData: false }
      })
    }));
    assert.equal(quality.result.components.length, 6);
    assert.ok(quality.profile.id);

    const harmonized = await json(await fetch(`${base}/api/v1/harmonize`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ record: { species: 'human', tissue: 'whole blood', assay: 'rnaseq' } })
    }));
    assert.equal(harmonized.result.harmonized.speciesId, 'NCBITaxon:9606');

    const run = await json(await fetch(`${base}/api/v1/runs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ workflowId: 'nf-core-rnaseq', projectId: project.id, inputs: [{ type: 'accession', value: 'GSE-DEMO' }] })
    }));
    assert.equal(run.status, 'draft-needs-pinning');
    assert.equal(run.checksum.length, 64);

    const report = await json(await fetch(`${base}/api/v1/reports`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId: project.id,
        question: 'Which public resources support the test question?',
        disease: 'tuberculosis',
        resourceIds: ['ibdc'],
        findings: ['A public source was selected.'],
        contradictions: ['No independent cohort was supplied.']
      })
    }));
    assert.equal(report.evidence.length, 1);
    assert.equal(report.checksum.length, 64);

    const key = await json(await fetch(`${base}/api/v1/api-keys`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Test automation', role: 'viewer' })
    }));
    assert.ok(key.secret.startsWith('ob_'));

    const apiKeyProjects = await json(await fetch(`${base}/api/v1/projects`, {
      headers: { 'x-api-key': key.secret, 'x-organization-id': organizationId }
    }));
    assert.ok(apiKeyProjects.projects.some((item) => item.id === project.id));

    const audit = await json(await fetch(`${base}/api/v1/audit?limit=100`, { headers: authHeaders }));
    assert.ok(audit.total >= 7);
    assert.ok(audit.events.some((event) => event.action === 'evidence_report.created'));
  });
});

test('private human workflow inputs are rejected by default', async () => {
  await withServer(async (base) => {
    const session = await json(await fetch(`${base}/api/v1/auth/demo`, { method: 'POST' }));
    const organizationId = session.organizations[0].id;
    const authHeaders = headers(session.token, organizationId);
    const projects = await json(await fetch(`${base}/api/v1/projects`, { headers: authHeaders }));
    const projectId = projects.projects[0].id;

    const response = await fetch(`${base}/api/v1/runs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ workflowId: 'nf-core-sarek', projectId, containsHumanData: true })
    });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.match(body.message, /not configured to accept private human genomic data/i);
  });
});

test('enterprise page and OpenAPI document are served', async () => {
  await withServer(async (base) => {
    const page = await fetch(`${base}/enterprise`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Evidence-to-decision workspace/);

    const openapi = await json(await fetch(`${base}/api/v1/openapi`));
    assert.equal(openapi.openapi, '3.1.0');
    assert.ok(openapi.paths['/quality/evaluate']);
  });
});
