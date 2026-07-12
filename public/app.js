const storage = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* Storage may be blocked. */ } }
};

const state = {
  quickMode: 'catalog',
  liveSource: 'publications',
  tool: 'fasta',
  catalog: [],
  catalogView: 'grid',
  language: storage.get('omics-language') || 'en'
};

const translations = {
  en: {
    eyebrow: 'Built for students, researchers and clinicians across India',
    heroTitle: 'Find public omics evidence. Understand it. Check your files.',
    heroDescription: 'One free place to discover trusted repositories, search live studies and literature, and run privacy-conscious QC checks—without uploading data to a permanent store.',
    exploreButton: 'Explore public resources',
    labButton: 'Open the free lab',
    catalogEyebrow: 'Verified starting points',
    catalogTitle: 'Explore public omics resources',
    catalogDescription: 'Filter India-focused and global repositories, databases, standards, institutes and policies. Inclusion never implies a partnership.'
  },
  hi: {
    eyebrow: 'भारत के विद्यार्थियों, शोधकर्ताओं और चिकित्सकों के लिए',
    heroTitle: 'सार्वजनिक ओमिक्स प्रमाण खोजें, समझें और अपनी फ़ाइलें जाँचें।',
    heroDescription: 'विश्वसनीय रिपॉज़िटरी खोजने, लाइव अध्ययन व साहित्य तलाशने और गोपनीयता-सचेत QC जाँच चलाने के लिए एक निःशुल्क स्थान—डेटा को स्थायी रूप से संग्रहीत किए बिना।',
    exploreButton: 'सार्वजनिक संसाधन देखें',
    labButton: 'निःशुल्क लैब खोलें',
    catalogEyebrow: 'सत्यापित शुरुआती संसाधन',
    catalogTitle: 'सार्वजनिक ओमिक्स संसाधन खोजें',
    catalogDescription: 'भारत-केंद्रित और वैश्विक रिपॉज़िटरी, डेटाबेस, मानक, संस्थान और नीतियाँ फ़िल्टर करें। सूची में होना साझेदारी नहीं दर्शाता।'
  },
  te: {
    eyebrow: 'భారతదేశంలోని విద్యార్థులు, పరిశోధకులు మరియు వైద్యుల కోసం',
    heroTitle: 'ప్రజలకు అందుబాటులో ఉన్న ఓమిక్స్ ఆధారాలను కనుగొని, అర్థం చేసుకుని, మీ ఫైళ్లను తనిఖీ చేయండి.',
    heroDescription: 'నమ్మదగిన రిపోజిటరీలను కనుగొనడానికి, లైవ్ అధ్యయనాలు మరియు సాహిత్యాన్ని శోధించడానికి, గోప్యతను కాపాడే QC తనిఖీలు చేయడానికి ఉచిత వేదిక—డేటాను శాశ్వతంగా నిల్వ చేయకుండా.',
    exploreButton: 'ప్రజా వనరులను చూడండి',
    labButton: 'ఉచిత ల్యాబ్ తెరవండి',
    catalogEyebrow: 'ధృవీకరించిన ప్రారంభ వనరులు',
    catalogTitle: 'ప్రజా ఓమిక్స్ వనరులను అన్వేషించండి',
    catalogDescription: 'భారతదేశానికి సంబంధించిన మరియు ప్రపంచ రిపోజిటరీలు, డేటాబేసులు, ప్రమాణాలు, సంస్థలు, విధానాలను ఫిల్టర్ చేయండి. జాబితాలో ఉండటం భాగస్వామ్యాన్ని సూచించదు.'
  }
};

const toolConfig = {
  fasta: {
    title: 'FASTA summary',
    description: 'Count sequences, identify molecule type, calculate lengths, N50 and GC percentage.',
    action: 'Run FASTA summary',
    endpoint: '/api/tools/fasta-summary',
    contentType: 'text/plain',
    placeholder: '>sample_1\nATGCGCGTAA',
    accept: '.fa,.fasta,.fna,.faa,.txt',
    example: '>sample_1 human_demo\nATGCGCGTAACTGNNNATGC\n>sample_2\nATATATGCGCGC'
  },
  vcf: {
    title: 'VCF structural QC',
    description: 'Count records, samples, filters and variant types, then estimate Ti/Tv and genotype call rate.',
    action: 'Run VCF QC',
    endpoint: '/api/tools/vcf-summary',
    contentType: 'text/plain',
    placeholder: '##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
    accept: '.vcf,.txt',
    example: '##fileformat=VCFv4.2\n##contig=<ID=1,length=248956422>\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tDEMO1\n1\t10177\trs367896724\tA\tAC\t100\tPASS\t.\tGT\t0/1\n1\t10352\trs555500075\tT\tTA\t99\tPASS\t.\tGT\t1/1\n1\t11008\t.\tC\tT\t80\tq10\t.\tGT\t./.'
  },
  table: {
    title: 'CSV/TSV profile',
    description: 'Detect delimiter, missingness, inconsistent rows, duplicate headers and basic column types.',
    action: 'Profile table',
    endpoint: '/api/tools/table-profile',
    contentType: 'text/plain',
    placeholder: 'sample_id,age_group,assay\nS001,40-49,RNA-seq',
    accept: '.csv,.tsv,.txt',
    example: 'sample_id,age_group,assay,state,case_status\nS001,40-49,RNA-seq,Telangana,case\nS002,50-59,RNA-seq,Kerala,control\nS003,,WGS,Maharashtra,case'
  },
  metadata: {
    title: 'Research metadata check',
    description: 'Check core study fields, privacy risks and reproducibility information before submission.',
    action: 'Check metadata',
    endpoint: '/api/tools/metadata-check',
    contentType: 'application/json',
    placeholder: '{\n  "title": "...",\n  "organism": "Homo sapiens"\n}',
    accept: '.json,.txt',
    example: JSON.stringify({
      title: 'Demo transcriptomics cohort',
      description: 'De-identified bulk RNA-seq study of adult participants.',
      organism: 'Homo sapiens',
      assay: 'bulk RNA-seq',
      sampleCount: 48,
      geography: 'Telangana, India',
      consent: 'Research use with disease-area limitation',
      dataAccess: 'controlled',
      contact: 'https://example.org/data-access',
      referenceGenome: 'GRCh38',
      ethicsApproval: 'Institutional ethics approval documented',
      dataUseLimitations: 'Non-commercial health research'
    }, null, 2)
  }
};

const els = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  bindNavigation();
  bindSearch();
  bindCatalog();
  bindLiveSearch();
  bindLab();
  bindLanguage();
  applyLanguage(state.language);
  applyCompactPreference();

  await Promise.allSettled([
    loadHealthAndStats(),
    loadFacets(),
    loadCatalog()
  ]);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

function cacheElements() {
  const ids = [
    'apiHealth', 'metricsGrid', 'catalogFilters', 'catalogQuery', 'kindFilter', 'omicsFilter', 'scopeFilter', 'accessFilter',
    'catalogResults', 'catalogCount', 'resetCatalog', 'quickSearchForm', 'quickSearchInput', 'quickIndiaOnly', 'liveSearchForm',
    'liveQuery', 'liveIndia', 'liveResults', 'checkSources', 'sourceStatus', 'toolTitle', 'toolDescription', 'toolFile',
    'toolInput', 'inputSize', 'loadExample', 'runTool', 'toolResult', 'resourceDialog', 'dialogContent', 'toastRegion',
    'languageSelect', 'compactToggle', 'menuToggle', 'mobileNav'
  ];
  ids.forEach((id) => { els[id] = document.getElementById(id); });
}

function bindNavigation() {
  els.menuToggle.addEventListener('click', () => {
    const expanded = els.menuToggle.getAttribute('aria-expanded') === 'true';
    els.menuToggle.setAttribute('aria-expanded', String(!expanded));
    els.mobileNav.hidden = expanded;
  });
  els.mobileNav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      els.mobileNav.hidden = true;
      els.menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
  els.compactToggle.addEventListener('click', () => {
    const active = document.body.classList.toggle('compact');
    els.compactToggle.setAttribute('aria-pressed', String(active));
    storage.set('omics-compact', active ? '1' : '0');
  });
}

function applyCompactPreference() {
  const active = storage.get('omics-compact') === '1';
  document.body.classList.toggle('compact', active);
  els.compactToggle.setAttribute('aria-pressed', String(active));
}

function bindLanguage() {
  els.languageSelect.value = state.language;
  els.languageSelect.addEventListener('change', () => applyLanguage(els.languageSelect.value));
}

function applyLanguage(language) {
  state.language = translations[language] ? language : 'en';
  storage.set('omics-language', state.language);
  document.documentElement.lang = state.language;
  els.languageSelect.value = state.language;
  const dictionary = translations[state.language];
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    if (dictionary[key]) node.textContent = dictionary[key];
  });
}

function bindSearch() {
  document.querySelectorAll('[data-quick-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-quick-mode]').forEach((item) => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-selected', String(item === button));
      });
      state.quickMode = button.dataset.quickMode;
      const placeholders = {
        catalog: 'Try: oral cancer RNA-seq',
        geo: 'Try: diabetes transcriptomics',
        publications: 'Try: pharmacogenomics India'
      };
      els.quickSearchInput.placeholder = placeholders[state.quickMode];
    });
  });

  document.querySelectorAll('[data-example]').forEach((button) => {
    button.addEventListener('click', () => {
      els.quickSearchInput.value = button.dataset.example;
      els.quickSearchInput.focus();
    });
  });

  els.quickSearchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = els.quickSearchInput.value.trim();
    if (!query) return;
    if (state.quickMode === 'catalog') {
      els.catalogQuery.value = query;
      await loadCatalog();
      document.getElementById('explore').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    state.liveSource = state.quickMode === 'geo' ? 'geo' : 'publications';
    syncLiveSourceButtons();
    els.liveQuery.value = query;
    els.liveIndia.checked = els.quickIndiaOnly.checked;
    document.getElementById('live-search').scrollIntoView({ behavior: 'smooth' });
    await runLiveSearch();
  });
}

async function loadHealthAndStats() {
  try {
    const [health, stats] = await Promise.all([api('/api/health'), api('/api/stats')]);
    els.apiHealth.className = 'status-pill ok';
    els.apiHealth.textContent = 'API operational';
    const metrics = [
      [stats.curatedResources, 'Curated public resources', 'Each card links to its source'],
      [stats.indiaFocusedResources, 'India-focused entries', 'Projects, institutes and policy'],
      [stats.omicsAreas, 'Omics and evidence areas', 'From genomics to standards'],
      [stats.analysisTools, 'Free local checks', 'FASTA, VCF, tables and metadata']
    ];
    els.metricsGrid.innerHTML = metrics.map(([value, label, note]) => `
      <article class="metric-card"><strong>${formatNumber(value)}</strong><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></article>
    `).join('');
    document.getElementById('footerVersion').textContent = `Version ${health.version}`;
  } catch (error) {
    els.apiHealth.className = 'status-pill error';
    els.apiHealth.textContent = 'API unavailable';
    els.metricsGrid.innerHTML = '<div class="empty-state"><h3>Backend not reachable</h3><p>Start the Node server and reload this page.</p></div>';
    showToast('Backend unavailable', error.message, 'error');
  }
}

function bindCatalog() {
  let timer;
  els.catalogFilters.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(loadCatalog, 220);
  });
  els.catalogFilters.addEventListener('change', loadCatalog);
  els.resetCatalog.addEventListener('click', () => {
    els.catalogFilters.reset();
    loadCatalog();
  });
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.catalogView = button.dataset.view;
      document.querySelectorAll('[data-view]').forEach((item) => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      els.catalogResults.classList.toggle('list-view', state.catalogView === 'list');
    });
  });
  els.catalogResults.addEventListener('click', (event) => {
    const details = event.target.closest('[data-resource-id]');
    if (details) openResourceDialog(details.dataset.resourceId);
  });
  els.resourceDialog.querySelector('.dialog-close').addEventListener('click', () => els.resourceDialog.close());
  els.resourceDialog.addEventListener('click', (event) => {
    if (event.target === els.resourceDialog) els.resourceDialog.close();
  });
}

async function loadFacets() {
  const facets = await api('/api/facets');
  populateSelect(els.kindFilter, facets.kinds);
  populateSelect(els.omicsFilter, facets.omics);
  populateSelect(els.scopeFilter, facets.scopes);
  populateSelect(els.accessFilter, facets.access);
}

function populateSelect(select, values) {
  const first = select.options[0];
  select.innerHTML = '';
  select.append(first);
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = titleCase(value);
    select.append(option);
  });
}

async function loadCatalog() {
  els.catalogResults.innerHTML = loadingMarkup('Loading public resources…');
  const params = new URLSearchParams();
  const values = {
    query: els.catalogQuery.value.trim(),
    kind: els.kindFilter.value,
    omics: els.omicsFilter.value,
    scope: els.scopeFilter.value,
    access: els.accessFilter.value
  };
  Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
  try {
    const data = await api(`/api/catalog?${params.toString()}`);
    state.catalog = data.results;
    els.catalogCount.textContent = `${formatNumber(data.total)} resource${data.total === 1 ? '' : 's'} found`;
    renderCatalog();
  } catch (error) {
    els.catalogResults.innerHTML = errorMarkup('Catalog unavailable', error.message);
  }
}

function renderCatalog() {
  if (!state.catalog.length) {
    els.catalogResults.innerHTML = '<div class="empty-state"><div class="empty-icon">0</div><h3>No matching resource</h3><p>Try removing a filter or using a broader omics term.</p></div>';
    return;
  }
  els.catalogResults.classList.toggle('list-view', state.catalogView === 'list');
  els.catalogResults.innerHTML = state.catalog.map((resource) => `
    <article class="resource-card">
      <div>
        <div class="resource-topline"><span class="resource-type">${escapeHtml(resource.scope)} · ${escapeHtml(resource.kind)}</span><span class="access-tag ${escapeHtml(resource.access)}">${escapeHtml(resource.access)}</span></div>
        <h3>${escapeHtml(resource.name)}</h3>
        <p class="resource-org">${escapeHtml(resource.organization)}</p>
      </div>
      <p class="resource-description">${escapeHtml(resource.description)}</p>
      <div>
        <div class="resource-tags">${resource.tags.slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
        <div class="resource-actions">
          <button type="button" data-resource-id="${escapeHtml(resource.id)}">Details</button>
          <a href="${escapeAttribute(resource.url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>
        </div>
      </div>
    </article>
  `).join('');
}

function openResourceDialog(id) {
  const resource = state.catalog.find((item) => item.id === id);
  if (!resource) return;
  els.dialogContent.innerHTML = `
    <p class="eyebrow">${escapeHtml(resource.scope)} · ${escapeHtml(resource.kind)}</p>
    <h2>${escapeHtml(resource.name)}</h2>
    <p class="resource-org">${escapeHtml(resource.organization)}</p>
    <p>${escapeHtml(resource.description)}</p>
    <div class="dialog-facts">
      <div class="dialog-fact"><strong>Access</strong><span>${escapeHtml(titleCase(resource.access))}</span></div>
      <div class="dialog-fact"><strong>Location/scope</strong><span>${escapeHtml(resource.state || resource.scope)}</span></div>
      <div class="dialog-fact"><strong>Omics</strong><span>${resource.omics.map(escapeHtml).join(', ')}</span></div>
      <div class="dialog-fact"><strong>Catalog review</strong><span>${escapeHtml(resource.verifiedOn)}</span></div>
    </div>
    <p><strong>Transparency:</strong> This is an external source. Omics Bharat does not host its data and does not claim a partnership.</p>
    <a class="button primary" href="${escapeAttribute(resource.url)}" target="_blank" rel="noopener noreferrer">Visit original source ↗</a>
  `;
  els.resourceDialog.showModal();
}

function bindLiveSearch() {
  document.querySelectorAll('[data-live-source]').forEach((button) => {
    button.addEventListener('click', () => {
      state.liveSource = button.dataset.liveSource;
      syncLiveSourceButtons();
      const placeholders = {
        publications: 'Example: pharmacogenomics India',
        geo: 'Example: oral cancer RNA-seq',
        sra: 'Example: tuberculosis whole genome sequencing',
        clinvar: 'Example: BRCA1 pathogenic'
      };
      els.liveQuery.placeholder = placeholders[state.liveSource];
    });
  });
  els.liveSearchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await runLiveSearch();
  });
  els.checkSources.addEventListener('click', checkSources);
}

function syncLiveSourceButtons() {
  document.querySelectorAll('[data-live-source]').forEach((button) => button.classList.toggle('active', button.dataset.liveSource === state.liveSource));
}

async function runLiveSearch() {
  const query = els.liveQuery.value.trim();
  if (!query) return;
  els.liveResults.className = 'live-results';
  els.liveResults.innerHTML = loadingMarkup('Querying the original public service…');
  const params = new URLSearchParams({ q: query, india: String(els.liveIndia.checked), limit: '15' });
  const url = state.liveSource === 'publications'
    ? `/api/live/publications?${params}`
    : `/api/live/studies?source=${encodeURIComponent(state.liveSource)}&${params}`;
  try {
    const data = await api(url);
    renderLiveResults(data);
  } catch (error) {
    els.liveResults.innerHTML = errorMarkup('Public source unavailable', error.message);
  }
}

function renderLiveResults(data) {
  if (!data.results.length) {
    els.liveResults.innerHTML = '<div class="empty-state"><div class="empty-icon">0</div><h3>No records returned</h3><p>Remove the India filter, use fewer terms, or try a broader source.</p></div>';
    return;
  }
  els.liveResults.innerHTML = `
    <div class="result-summary"><span><strong>${formatNumber(data.hitCount)}</strong> total matches · showing ${data.results.length}</span><span>${escapeHtml(data.source)}${data.cached ? ' · cached briefly' : ''}</span></div>
    <div class="result-list">${data.results.map((item) => liveResultCard(item)).join('')}</div>
  `;
}

function liveResultCard(item) {
  const metadata = [item.accession, item.year || item.date, item.journal, item.organism, item.sampleCount ? `${item.sampleCount} samples` : null, item.isOpenAccess ? 'Open access' : null].filter(Boolean);
  return `
    <article class="live-result-card">
      <h3><a href="${escapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title || 'Untitled record')} ↗</a></h3>
      <div class="result-meta">${metadata.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}</div>
      ${item.authors ? `<p>${escapeHtml(item.authors)}</p>` : ''}
      ${item.summary ? `<p>${escapeHtml(truncate(item.summary, 320))}</p>` : ''}
    </article>
  `;
}

async function checkSources() {
  els.checkSources.disabled = true;
  els.checkSources.textContent = 'Checking…';
  els.sourceStatus.hidden = false;
  els.sourceStatus.innerHTML = loadingMarkup('Checking NCBI and Europe PMC…');
  try {
    const data = await api('/api/live/status');
    els.sourceStatus.innerHTML = `<div class="source-status-grid">${data.sources.map((source) => `
      <div class="source-status-item"><strong>${escapeHtml(source.name)} · ${escapeHtml(source.status)}</strong><span>${formatNumber(source.latencyMs)} ms${source.message ? ` · ${escapeHtml(source.message)}` : ''}</span></div>
    `).join('')}</div>`;
  } catch (error) {
    els.sourceStatus.innerHTML = errorMarkup('Status check failed', error.message);
  } finally {
    els.checkSources.disabled = false;
    els.checkSources.textContent = 'Check source status';
  }
}

function bindLab() {
  document.querySelectorAll('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => selectTool(button.dataset.tool));
  });
  els.toolInput.addEventListener('input', updateInputSize);
  els.toolFile.addEventListener('change', async () => {
    const file = els.toolFile.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('File too large', 'The maximum input size is 5 MB.', 'error');
      els.toolFile.value = '';
      return;
    }
    els.toolInput.value = await file.text();
    updateInputSize();
  });
  els.loadExample.addEventListener('click', () => {
    els.toolInput.value = toolConfig[state.tool].example;
    updateInputSize();
  });
  els.runTool.addEventListener('click', runTool);
  selectTool('fasta');
}

function selectTool(tool) {
  state.tool = toolConfig[tool] ? tool : 'fasta';
  document.querySelectorAll('[data-tool]').forEach((button) => {
    const active = button.dataset.tool === state.tool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const config = toolConfig[state.tool];
  els.toolTitle.textContent = config.title;
  els.toolDescription.textContent = config.description;
  els.runTool.textContent = config.action;
  els.toolInput.placeholder = config.placeholder;
  els.toolFile.accept = config.accept;
  els.toolInput.value = '';
  els.toolFile.value = '';
  updateInputSize();
  els.toolResult.className = 'tool-result empty-state';
  els.toolResult.innerHTML = '<div class="empty-icon">⌁</div><h3>Results appear here</h3><p>Do not paste identifiable participant data, clinical notes or secrets.</p>';
}

function updateInputSize() {
  els.inputSize.textContent = formatBytes(new Blob([els.toolInput.value]).size);
}

async function runTool() {
  const input = els.toolInput.value;
  if (!input.trim()) {
    showToast('Input required', 'Paste text or choose a local file first.', 'error');
    return;
  }
  if (new Blob([input]).size > 5 * 1024 * 1024) {
    showToast('Input too large', 'Keep the input below 5 MB.', 'error');
    return;
  }
  const config = toolConfig[state.tool];
  els.runTool.disabled = true;
  els.runTool.textContent = 'Analysing…';
  els.toolResult.className = 'tool-result';
  els.toolResult.innerHTML = loadingMarkup('Processing in memory…');
  try {
    const body = state.tool === 'metadata' ? JSON.stringify(JSON.parse(input)) : input;
    const data = await api(config.endpoint, { method: 'POST', headers: { 'Content-Type': config.contentType }, body });
    renderToolResult(state.tool, data.result, data.retention);
  } catch (error) {
    els.toolResult.innerHTML = errorMarkup('Check failed', error.message);
  } finally {
    els.runTool.disabled = false;
    els.runTool.textContent = config.action;
  }
}

function renderToolResult(tool, result, retention) {
  const renderers = { fasta: renderFasta, vcf: renderVcf, table: renderTableProfile, metadata: renderMetadata };
  els.toolResult.innerHTML = `
    <div class="result-title"><h3>${escapeHtml(toolConfig[tool].title)} results</h3><span class="retention-note">${escapeHtml(retention)}</span></div>
    ${renderers[tool](result)}
  `;
}

function renderFasta(result) {
  const kpis = [
    [result.sequenceCount, 'Sequences'], [result.moleculeType, 'Molecule type'], [formatNumber(result.totalLength), 'Total length'],
    [formatNumber(result.n50), 'N50'], [result.gcPercent == null ? '—' : `${result.gcPercent}%`, 'GC'], [result.ambiguousPercent == null ? '—' : `${result.ambiguousPercent}%`, 'Ambiguous bases']
  ];
  return `${kpiMarkup(kpis)}
    <div class="result-section"><h4>Sequence records</h4><table class="result-table"><thead><tr><th>ID</th><th>Description</th><th>Length</th></tr></thead><tbody>${result.records.map((row) => `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.description)}</td><td>${formatNumber(row.length)}</td></tr>`).join('')}</tbody></table></div>
    ${noticeMarkup(result.warnings)}`;
}

function renderVcf(result) {
  const kpis = [
    [formatNumber(result.records), 'Records'], [result.sampleCount, 'Samples'], [result.variantTypes.snv, 'SNVs'],
    [result.variantTypes.insertion, 'Insertions'], [result.variantTypes.deletion, 'Deletions'], [result.genotypeCallRatePercent == null ? '—' : `${result.genotypeCallRatePercent}%`, 'Call rate']
  ];
  const types = Object.entries(result.variantTypes).map(([name, count]) => `<tr><td>${escapeHtml(titleCase(name))}</td><td>${formatNumber(count)}</td></tr>`).join('');
  return `${kpiMarkup(kpis)}
    <div class="result-section"><h4>Variant classes</h4><table class="result-table"><thead><tr><th>Class</th><th>Count</th></tr></thead><tbody>${types}</tbody></table></div>
    <div class="result-section"><h4>Additional QC</h4><p>VCF ${escapeHtml(result.version)} · ${formatNumber(result.multiallelicRecords)} multiallelic records · Ti/Tv ${result.transitionTransversionRatio ?? 'not available'}</p></div>
    ${noticeMarkup([...result.problems, ...result.notes])}`;
}

function renderTableProfile(result) {
  const kpis = [[result.rowCount, 'Rows'], [result.columnCount, 'Columns'], [result.format, 'Format'], [result.delimiter, 'Delimiter'], [result.inconsistentRows.length, 'Inconsistent rows'], [result.duplicateHeaderNames.length, 'Duplicate headers']];
  return `${kpiMarkup(kpis)}
    <div class="result-section"><h4>Column profile</h4><table class="result-table"><thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Unique</th></tr></thead><tbody>${result.columns.map((column) => `<tr><td>${escapeHtml(column.name)}</td><td>${escapeHtml(column.inferredType)}</td><td>${column.missingPercent}%</td><td>${formatNumber(column.uniqueValues)}</td></tr>`).join('')}</tbody></table></div>
    ${noticeMarkup(result.recommendations)}`;
}

function renderMetadata(result) {
  const checks = result.checks.map((check) => `<tr><td>${check.valid ? '✓' : '—'}</td><td>${escapeHtml(check.field)}</td><td>${escapeHtml(check.label)}</td></tr>`).join('');
  return `<div class="result-title"><div class="score-ring" style="--score:${result.score}%"><strong>${result.score}%</strong></div><div><h4>${result.passed} of ${result.total} core fields present</h4><p>${escapeHtml(result.disclaimer)}</p></div></div>
    <div class="result-section"><h4>Core checklist</h4><table class="result-table"><thead><tr><th>Status</th><th>Field</th><th>Purpose</th></tr></thead><tbody>${checks}</tbody></table></div>
    ${noticeMarkup(result.warnings)}
    <div class="result-section"><h4>Useful additional fields</h4><div class="resource-tags">${result.suggestedFields.map((field) => `<span>${escapeHtml(field)}</span>`).join('')}</div></div>`;
}

function kpiMarkup(items) {
  return `<div class="kpi-grid">${items.map(([value, label]) => `<div class="kpi"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('')}</div>`;
}

function noticeMarkup(items = []) {
  if (!items.length) return '';
  return `<div class="result-section"><h4>Notes</h4><ul class="notice-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`;
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : { message: await response.text() };
  if (!response.ok) {
    const error = new Error(payload.detail || payload.message || `Request failed with HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function loadingMarkup(message) {
  return `<div class="empty-state"><div class="empty-icon">…</div><h3>${escapeHtml(message)}</h3><p>Please keep this page open while the current request completes.</p></div>`;
}

function errorMarkup(title, message) {
  return `<div class="empty-state"><div class="empty-icon">!</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div>`;
}

function showToast(title, message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  els.toastRegion.append(toast);
  setTimeout(() => toast.remove(), 5000);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function escapeAttribute(value) {
  const string = String(value || '');
  if (!/^https:\/\//i.test(string) && !string.startsWith('/')) return '#';
  return escapeHtml(string);
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('en-IN').format(number) : String(value ?? '—');
}

function formatBytes(bytes) {
  if (!bytes) return '0 bytes';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function titleCase(value) {
  return String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function truncate(value, limit) {
  const text = String(value || '');
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}
