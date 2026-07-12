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

test('health and stats endpoints are operational', async () => {
  await withServer(async (base) => {
    const healthResponse = await fetch(`${base}/api/health`);
    assert.equal(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.equal(health.status, 'ok');
    assert.equal(health.version, '2.0.0');

    const statsResponse = await fetch(`${base}/api/stats`);
    const stats = await statsResponse.json();
    assert.ok(stats.curatedResources >= 20);
    assert.equal(stats.analysisTools, 4);
  });
});

test('catalog can filter India resources', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/catalog?scope=India`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data.total > 0);
    assert.ok(data.results.every((item) => item.scope === 'India'));
  });
});

test('analysis endpoint accepts plain text and does not claim persistence', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/tools/fasta-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '>x\nACGT'
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.result.sequenceCount, 1);
    assert.match(data.retention, /not stored/i);
  });
});

test('static application is served with security headers', async () => {
  await withServer(async (base) => {
    const response = await fetch(base);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const html = await response.text();
    assert.match(html, /Omics Bharat/);
  });
});
