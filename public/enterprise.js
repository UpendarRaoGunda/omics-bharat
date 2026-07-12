const state = {
  token: sessionStorage.getItem('omics-enterprise-token') || '',
  status: null,
  plans: [],
  workflows: [],
  user: null,
  organizations: [],
  organizationId: sessionStorage.getItem('omics-enterprise-org') || '',
  projects: [],
  selectedResources: new Map(),
  currentPanel: 'overview'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function toast(title, message = '', type = 'success') {
  const region = $('#toastRegion');
  const item = document.createElement('div');
  item.className = `toast ${type === 'error' ? 'error' : ''}`;
  item.innerHTML = `<strong>${escapeHtml(title)}</strong>${message ? `<span>${escapeHtml(message)}</span>` : ''}`;
  region.append(item);
  setTimeout(() => item.remove(), 4200);
}

function splitLines(value) {
  return String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function parseJsonInput(selector, fallback) {
  const raw = $(selector).value.trim();
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { throw new Error(`Invalid JSON in ${selector}.`); }
}

async function api(path, options = {}, authenticated = true) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (authenticated && state.token) headers.set('authorization', `Bearer ${state.token}`);
  if (authenticated && state.organizationId) headers.set('x-organization-id', state.organizationId);
  const response = await fetch(path, { ...options, headers });
  const text = response.status === 204 ? '' : await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) {
    const error = new Error(data?.message || `Request failed with ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function panelTitle(panel) {
  return {
    overview: 'Workspace overview',
    searches: 'Evidence watchlists',
    quality: 'Dataset quality',
    harmonize: 'Metadata harmonization',
    workflows: 'Workflow manifests',
    reports: 'Evidence packages',
    governance: 'Governance and API access',
    commercial: 'Commercial model'
  }[panel] || 'Enterprise workspace';
}

function switchPanel(panel) {
  state.currentPanel = panel;
  $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.panel === panel));
  $$('[data-panel-content]').forEach((section) => section.classList.toggle('active', section.dataset.panelContent === panel));
  $('#panelTitle').textContent = panelTitle(panel);
  window.scrollTo({ top: $('#workspace').offsetTop - 80, behavior: 'smooth' });
  if (panel === 'governance') refreshGovernance();
}

function currentOrganization() {
  return state.organizations.find((item) => item.id === state.organizationId) || state.organizations[0] || null;
}

function populateOrganizationSelect() {
  const select = $('#organizationSelect');
  select.innerHTML = '';
  for (const organization of state.organizations) {
    const option = document.createElement('option');
    option.value = organization.id;
    option.textContent = `${organization.name} · ${organization.role}`;
    select.append(option);
  }
  if (!state.organizationId || !state.organizations.some((item) => item.id === state.organizationId)) {
    state.organizationId = state.organizations[0]?.id || '';
  }
  select.value = state.organizationId;
  select.disabled = !state.organizationId;
  sessionStorage.setItem('omics-enterprise-org', state.organizationId);
  const organization = currentOrganization();
  $('#tenantName').textContent = organization?.name || 'No active workspace';
  $('#tenantRole').textContent = organization ? `${organization.role} · ${organization.plan}` : 'Start a demo session';
  $('#metricPlan').textContent = organization?.plan || '—';
}

function populateProjectSelects() {
  const selectors = ['#searchProject', '#qualityProject', '#runProject', '#reportProject'];
  for (const selector of selectors) {
    const select = $(selector);
    const current = select.value;
    select.innerHTML = '<option value="">Select project</option>';
    for (const project of state.projects) {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      select.append(option);
    }
    if (state.projects.some((project) => project.id === current)) select.value = current;
    else if (state.projects[0]) select.value = state.projects[0].id;
  }
}

async function loadPublicPlatform() {
  const [statusData, planData, workflowData] = await Promise.all([
    api('/api/v1/status', {}, false),
    api('/api/v1/plans', {}, false),
    api('/api/v1/workflows', {}, false)
  ]);
  state.status = statusData;
  state.plans = planData.plans || [];
  state.workflows = workflowData.workflows || [];
  renderPublicStatus();
  renderPlans();
  renderWorkflows();
}

function renderPublicStatus() {
  const badge = $('#deploymentBadge');
  badge.className = 'status-badge ready';
  badge.textContent = `${state.status.mode} · ${state.status.workflowExecutor}`;
  $('#metricMode').textContent = state.status.mode;
  $('#metricPersistence').textContent = state.status.persistence;
  $('#executorBadge').textContent = state.status.workflowExecutor === 'webhook' ? 'Executor connected' : 'Manifest only';
  $('#sessionButton').textContent = state.token ? 'Session active' : state.status.demoEnabled ? 'Start safe demo' : 'Sign in';
}

function renderPlans() {
  const grid = $('#planGrid');
  grid.innerHTML = state.plans.map((plan) => `
    <article class="plan-card ${plan.id === 'enterprise' ? 'featured' : ''}">
      <span class="plan-label">${escapeHtml(plan.audience)}</span>
      <h4>${escapeHtml(plan.name)}</h4>
      <p>${plan.commercial ? 'Governed commercial capability' : 'Public community infrastructure'}</p>
      <div class="plan-price">${escapeHtml(plan.price)}</div>
      <ul>${(plan.features || []).map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>
      <a class="button ${plan.id === 'enterprise' ? 'primary' : 'ghost'}" href="mailto:support@omicsbharat.example?subject=${encodeURIComponent(`Omics Bharat ${plan.name}`)}">Discuss ${escapeHtml(plan.name)}</a>
    </article>
  `).join('');
}

function renderWorkflows() {
  $('#workflowGrid').innerHTML = state.workflows.map((workflow) => `
    <article class="workflow-card">
      <span>${escapeHtml(workflow.category)} · ${escapeHtml(workflow.engine)}</span>
      <h4>${escapeHtml(workflow.name)}</h4>
      <p>${escapeHtml(workflow.purpose)}</p>
      <small>${escapeHtml(workflow.versionPolicy)}</small>
    </article>
  `).join('');
  const select = $('#runWorkflow');
  select.innerHTML = state.workflows.map((workflow) => `<option value="${escapeHtml(workflow.id)}">${escapeHtml(workflow.name)}</option>`).join('');
}

async function startDemo() {
  try {
    const session = await api('/api/v1/auth/demo', { method: 'POST', body: '{}' }, false);
    setSession(session);
    toast('Demo workspace ready', 'Only use non-sensitive example data.');
    await loadWorkspace();
  } catch (error) {
    if (error.status === 403) {
      $('#authPanel').hidden = false;
      toast('Demo unavailable', 'Use the configured production sign-in.', 'error');
    } else toast('Could not start demo', error.message, 'error');
  }
}

function setSession(session) {
  state.token = session.token;
  state.user = session.user;
  state.organizations = session.organizations || [];
  sessionStorage.setItem('omics-enterprise-token', state.token);
  populateOrganizationSelect();
  $('#lockedState').hidden = true;
  $('#workspacePanels').hidden = false;
  $('#sessionButton').textContent = 'Session active';
}

async function restoreSession() {
  if (!state.token) return false;
  try {
    const me = await api('/api/v1/me');
    state.user = me.user;
    state.organizations = me.organizations || [];
    populateOrganizationSelect();
    $('#lockedState').hidden = true;
    $('#workspacePanels').hidden = false;
    $('#sessionButton').textContent = 'Session active';
    return true;
  } catch {
    sessionStorage.removeItem('omics-enterprise-token');
    state.token = '';
    return false;
  }
}

async function loadWorkspace() {
  if (!state.token) return;
  await Promise.all([loadProjects(), loadSavedSearches(), loadAudit(false)]);
  $('#metricProjects').textContent = String(state.projects.length);
}

async function loadProjects() {
  const data = await api('/api/v1/projects');
  state.projects = data.projects || [];
  populateProjectSelects();
  const list = $('#projectList');
  if (!state.projects.length) {
    list.className = 'record-list empty';
    list.innerHTML = '<p>No projects yet.</p>';
    return;
  }
  list.className = 'record-list';
  list.innerHTML = state.projects.map((project) => `
    <article class="record"><div><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.description || 'No description')}</small><div class="record-meta"><span>${escapeHtml(project.status)}</span><span>${project.researchUseOnly ? 'Research-use only' : 'Custom intended use'}</span></div></div></article>
  `).join('');
}

async function loadSavedSearches() {
  const data = await api('/api/v1/saved-searches');
  const searches = data.savedSearches || [];
  const list = $('#savedSearchList');
  if (!searches.length) {
    list.className = 'card record-list empty';
    list.innerHTML = '<p>No watchlists yet.</p>';
    return;
  }
  list.className = 'card record-list';
  list.innerHTML = searches.map((item) => `
    <article class="record"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.query)}</small><div class="record-meta"><span>${escapeHtml(item.source)}</span><span>${escapeHtml(item.alertCadence)}</span></div></div><button type="button" data-delete-search="${escapeHtml(item.id)}">Delete</button></article>
  `).join('');
}

function qualityPayload() {
  const governance = $('#qualityGovernance').value.trim();
  return {
    projectId: $('#qualityProject').value || null,
    datasetLabel: $('#qualityTitle').value.trim(),
    resourceId: $('#qualityAccession').value.trim() || null,
    persist: $('#qualityPersist').checked,
    metadata: {
      title: $('#qualityTitle').value.trim(),
      description: 'Dataset evaluated in the Omics Bharat enterprise workspace.',
      disease: $('#qualityDisease').value.trim(),
      tissue: $('#qualityTissue').value.trim(),
      species: $('#qualitySpecies').value.trim(),
      assay: $('#qualityAssay').value.trim(),
      sampleSize: Number($('#qualitySampleSize').value) || null,
      groups: ['case', 'control'],
      platform: 'Documented by study team',
      publication: 'Review required',
      accession: $('#qualityAccession').value.trim(),
      contact: 'Study contact required',
      source: 'Public accession or organization source',
      sourceUrl: 'Review required',
      retrievedAt: new Date().toISOString(),
      version: 'Current review snapshot',
      geography: $('#qualityGeography').value.trim(),
      ancestryDescription: '',
      access: $('#qualityAccess').value,
      license: governance || '',
      dataUseConditions: governance || '',
      humanData: $('#qualityHuman').checked,
      consent: governance || '',
      ethicsApproval: governance || '',
      qualityControl: $('#qualityQc').value.trim(),
      workflow: { name: 'Not yet selected', version: '', containerDigest: '' }
    }
  };
}

function renderQuality(result) {
  const target = $('#qualityResult');
  target.className = 'result-card';
  target.innerHTML = `
    <div class="quality-summary"><div class="score-circle">${escapeHtml(result.score)}</div><div><h4>Grade ${escapeHtml(result.grade)}</h4><p>${escapeHtml(result.interpretation)}</p></div></div>
    <div class="component-list">${result.components.map((component) => `<div class="component"><span>${escapeHtml(component.label)}</span><progress max="100" value="${Number(component.score)}"></progress><b>${escapeHtml(component.score)}</b></div>`).join('')}</div>
    <div class="warning-list"><strong>Priority warnings and actions</strong><ul>${[...result.warnings, ...result.priorityActions.slice(0, 6).map((item) => item.action)].map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>No warnings generated; scientific review remains required.</li>'}</ul></div>
    <p class="result-boundary">${escapeHtml(result.boundaries.join(' '))}</p>
  `;
}

function renderRun(run) {
  const target = $('#runResult');
  target.className = 'result-card';
  target.innerHTML = `
    <div class="card-heading"><div><p class="kicker">Run manifest</p><h3>${escapeHtml(run.workflow.name)}</h3></div><span class="chip">${escapeHtml(run.status)}</span></div>
    <div class="record-meta"><span>${escapeHtml(run.id)}</span><span>${escapeHtml(run.workflow.engine)}</span><span>${escapeHtml(run.checksum.slice(0, 16))}…</span></div>
    <div class="warning-list"><strong>Pinning status</strong><ul>${run.missingPins?.length ? run.missingPins.map((item) => `<li>Provide ${escapeHtml(item)}</li>`).join('') : '<li>Required execution pins are present.</li>'}</ul></div>
    <pre class="report-markdown">${escapeHtml(JSON.stringify(run, null, 2))}</pre>
  `;
}

function renderReport(report) {
  const target = $('#reportResult');
  target.className = 'result-card';
  target.innerHTML = `
    <div class="card-heading"><div><p class="kicker">Evidence package</p><h3>${escapeHtml(report.title)}</h3></div><span class="chip">${escapeHtml(report.decisionReadiness.status)}</span></div>
    <div class="record-meta"><span>${report.evidence.length} sources</span><span>${report.decisionReadiness.scoredSourceCount} quality-scored</span><span>${escapeHtml(report.checksum.slice(0, 16))}…</span></div>
    <pre class="report-markdown">${escapeHtml(report.markdown)}</pre>
  `;
}

async function searchReportResources() {
  const query = $('#reportResourceQuery').value.trim();
  if (!query) return;
  const data = await api(`/api/catalog?query=${encodeURIComponent(query)}&limit=12`, {}, false);
  const results = $('#reportResourceResults');
  if (!data.results.length) {
    results.innerHTML = '<p>No matching resources.</p>';
    return;
  }
  results.innerHTML = data.results.map((resource) => `
    <label class="picker-item"><input type="checkbox" data-resource-id="${escapeHtml(resource.id)}" ${state.selectedResources.has(resource.id) ? 'checked' : ''}><span><strong>${escapeHtml(resource.name)}</strong><small>${escapeHtml(resource.organization)} · ${escapeHtml(resource.access)}</small></span></label>
  `).join('');
  for (const resource of data.results) {
    const checkbox = $(`[data-resource-id="${CSS.escape(resource.id)}"]`, results);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selectedResources.set(resource.id, resource);
      else state.selectedResources.delete(resource.id);
      renderSelectedResources();
    });
  }
}

function renderSelectedResources() {
  const target = $('#selectedResources');
  if (!state.selectedResources.size) {
    target.innerHTML = '<strong>Selected sources</strong><span>None selected</span>';
    return;
  }
  target.innerHTML = `<strong>Selected sources</strong><span>${[...state.selectedResources.values()].map((item) => escapeHtml(item.name)).join(' · ')}</span>`;
}

async function loadAudit(showToast = false) {
  if (!state.token) return;
  const data = await api('/api/v1/audit?limit=100');
  const events = data.events || [];
  $('#metricAudit').textContent = String(data.total || events.length);
  const list = $('#auditList');
  if (!events.length) {
    list.className = 'audit-list empty';
    list.innerHTML = '<p>No audit events.</p>';
  } else {
    list.className = 'audit-list';
    list.innerHTML = events.map((event) => `<article class="audit-item"><strong>${escapeHtml(event.action)}</strong><small>${escapeHtml(event.resourceType)} · ${escapeHtml(event.resourceId)} · ${escapeHtml(new Date(event.createdAt).toLocaleString())}</small></article>`).join('');
  }
  if (showToast) toast('Audit refreshed', `${events.length} events loaded.`);
}

async function loadApiKeys() {
  if (!state.token) return;
  const data = await api('/api/v1/api-keys');
  const keys = data.apiKeys || [];
  const list = $('#apiKeyList');
  if (!keys.length) {
    list.className = 'record-list empty';
    list.innerHTML = '<p>No API keys.</p>';
    return;
  }
  list.className = 'record-list';
  list.innerHTML = keys.map((key) => `
    <article class="record"><div><strong>${escapeHtml(key.name)}</strong><small>${escapeHtml(key.prefix)}… · ${escapeHtml(key.role)}</small><div class="record-meta"><span>${key.revokedAt ? 'Revoked' : 'Active'}</span><span>${key.lastUsedAt ? `Last used ${escapeHtml(new Date(key.lastUsedAt).toLocaleString())}` : 'Never used'}</span></div></div>${key.revokedAt ? '' : `<button type="button" data-revoke-key="${escapeHtml(key.id)}">Revoke</button>`}</article>
  `).join('');
}

async function refreshGovernance() {
  if (!state.token) return;
  await Promise.all([loadAudit(false), loadApiKeys()]);
}

function bindNavigation() {
  $$('.nav-item').forEach((button) => button.addEventListener('click', () => switchPanel(button.dataset.panel)));
  $('#refreshButton').addEventListener('click', async () => {
    try {
      if (state.currentPanel === 'governance') await refreshGovernance();
      else await loadWorkspace();
      toast('Workspace refreshed');
    } catch (error) { toast('Refresh failed', error.message, 'error'); }
  });
  $('#organizationSelect').addEventListener('change', async () => {
    state.organizationId = $('#organizationSelect').value;
    sessionStorage.setItem('omics-enterprise-org', state.organizationId);
    populateOrganizationSelect();
    await loadWorkspace();
  });
}

function bindAuthentication() {
  $('#sessionButton').addEventListener('click', () => state.token ? toast('Session active', state.user?.email || '') : startDemo());
  $('#heroDemoButton').addEventListener('click', startDemo);
  $$('[data-start-demo]').forEach((button) => button.addEventListener('click', startDemo));
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const session = await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: $('#loginEmail').value, password: $('#loginPassword').value })
      }, false);
      setSession(session);
      $('#authPanel').hidden = true;
      await loadWorkspace();
      toast('Signed in');
    } catch (error) { toast('Sign-in failed', error.message, 'error'); }
  });
}

function bindForms() {
  $('#projectForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/v1/projects', { method: 'POST', body: JSON.stringify({
        name: $('#projectName').value,
        description: $('#projectDescription').value,
        status: $('#projectStatus').value,
        researchUseOnly: $('#projectRuo').checked
      }) });
      event.target.reset();
      $('#projectRuo').checked = true;
      await loadProjects();
      $('#metricProjects').textContent = String(state.projects.length);
      toast('Project created');
    } catch (error) { toast('Project creation failed', error.message, 'error'); }
  });

  $('#searchForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/api/v1/saved-searches', { method: 'POST', body: JSON.stringify({
        name: $('#searchName').value,
        query: $('#searchQuery').value,
        source: $('#searchSource').value,
        projectId: $('#searchProject').value || null,
        alertCadence: $('#searchCadence').value
      }) });
      event.target.reset();
      populateProjectSelects();
      await loadSavedSearches();
      toast('Watchlist saved');
    } catch (error) { toast('Could not save watchlist', error.message, 'error'); }
  });

  $('#savedSearchList').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-search]');
    if (!button) return;
    try {
      await api(`/api/v1/saved-searches/${encodeURIComponent(button.dataset.deleteSearch)}`, { method: 'DELETE' });
      await loadSavedSearches();
      toast('Watchlist deleted');
    } catch (error) { toast('Delete failed', error.message, 'error'); }
  });

  $('#qualityForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await api('/api/v1/quality/evaluate', { method: 'POST', body: JSON.stringify(qualityPayload()) });
      renderQuality(data.result);
      toast('Quality profile generated', `Score ${data.result.score}, grade ${data.result.grade}.`);
    } catch (error) { toast('Quality evaluation failed', error.message, 'error'); }
  });

  $('#harmonizeForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const record = parseJsonInput('#harmonizeInput', {});
      const data = await api('/api/v1/harmonize', { method: 'POST', body: JSON.stringify({ record }) });
      $('#harmonizeResult').textContent = JSON.stringify(data.result, null, 2);
      toast('Metadata harmonized', data.result.reviewRequired ? 'Human review is required.' : 'All mappings resolved.');
    } catch (error) { toast('Harmonization failed', error.message, 'error'); }
  });

  $('#runForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const body = {
        workflowId: $('#runWorkflow').value,
        projectId: $('#runProject').value,
        workflowVersion: $('#runVersion').value.trim(),
        workflowCommit: $('#runCommit').value.trim(),
        referenceBundle: $('#runReference').value.trim(),
        containerDigests: $('#runContainer').value.trim() ? { primary: $('#runContainer').value.trim() } : {},
        inputs: parseJsonInput('#runInputs', []),
        parameters: parseJsonInput('#runParameters', {}),
        containsHumanData: $('#runHuman').checked,
        dispatch: $('#runDispatch').checked
      };
      const run = await api('/api/v1/runs', { method: 'POST', body: JSON.stringify(body) });
      renderRun(run);
      toast('Run manifest created', run.status);
    } catch (error) { toast('Run manifest failed', error.message, 'error'); }
  });

  $('#reportResourceSearch').addEventListener('click', () => searchReportResources().catch((error) => toast('Catalog search failed', error.message, 'error')));
  $('#reportResourceQuery').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); $('#reportResourceSearch').click(); }
  });

  $('#reportForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const report = await api('/api/v1/reports', { method: 'POST', body: JSON.stringify({
        projectId: $('#reportProject').value,
        question: $('#reportQuestion').value,
        disease: $('#reportDisease').value,
        target: $('#reportTarget').value,
        geography: $('#reportGeography').value,
        decisionContext: 'Translational research evidence review',
        resourceIds: [...state.selectedResources.keys()],
        findings: splitLines($('#reportFindings').value),
        contradictions: splitLines($('#reportContradictions').value),
        independentValidation: $('#reportValidation').checked,
        populationRelevance: $('#reportPopulation').checked
      }) });
      renderReport(report);
      toast('Evidence package generated', `${report.evidence.length} sources attached.`);
    } catch (error) { toast('Report generation failed', error.message, 'error'); }
  });

  $('#apiKeyForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await api('/api/v1/api-keys', { method: 'POST', body: JSON.stringify({ name: $('#apiKeyName').value, role: $('#apiKeyRole').value }) });
      const secret = $('#apiKeySecret');
      secret.hidden = false;
      secret.textContent = `Copy once: ${data.secret}`;
      event.target.reset();
      await loadApiKeys();
      toast('API key created', 'Copy the secret now; only its hash is retained.');
    } catch (error) { toast('API key creation failed', error.message, 'error'); }
  });

  $('#apiKeyList').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-revoke-key]');
    if (!button) return;
    try {
      await api(`/api/v1/api-keys/${encodeURIComponent(button.dataset.revokeKey)}`, { method: 'DELETE' });
      await loadApiKeys();
      toast('API key revoked');
    } catch (error) { toast('Revocation failed', error.message, 'error'); }
  });
  $('#auditRefresh').addEventListener('click', () => loadAudit(true).catch((error) => toast('Audit refresh failed', error.message, 'error')));
}

async function init() {
  bindNavigation();
  bindAuthentication();
  bindForms();
  try {
    await loadPublicPlatform();
    const restored = await restoreSession();
    if (restored) await loadWorkspace();
    if (!state.status.demoEnabled && !state.token) $('#authPanel').hidden = false;
  } catch (error) {
    $('#deploymentBadge').className = 'status-badge';
    $('#deploymentBadge').textContent = 'Unavailable';
    toast('Enterprise preview unavailable', error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
