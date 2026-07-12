import { TtlCache } from './cache.js';

const cache = new TtlCache({ ttlMs: 5 * 60 * 1000, maxEntries: 200 });
const USER_AGENT = process.env.OUTBOUND_USER_AGENT || 'OmicsBharat/2.0 (public research discovery; contact via repository)';
const NCBI_TOOL = encodeURIComponent(process.env.NCBI_TOOL || 'omics_bharat');
const NCBI_EMAIL = process.env.NCBI_EMAIL ? `&email=${encodeURIComponent(process.env.NCBI_EMAIL)}` : '';

async function fetchJson(url, { timeoutMs = 10000 } = {}) {
  const cached = cache.get(url);
  if (cached) return { data: cached, cached: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal
    });
    if (!response.ok) {
      const error = new Error(`Upstream service responded with HTTP ${response.status}.`);
      error.statusCode = 502;
      error.upstreamStatus = response.status;
      throw error;
    }
    const data = await response.json();
    cache.set(url, data);
    return { data, cached: false };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('The upstream public service timed out. Please try again.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function clampLimit(value, fallback = 15, maximum = 30) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), maximum);
}

function sanitiseQuery(query) {
  return String(query || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 300);
}

export async function searchEuropePmc({ query, india = false, limit = 15 }) {
  const cleanQuery = sanitiseQuery(query);
  if (!cleanQuery) throw badRequest('Enter a publication search query.');
  const pageSize = clampLimit(limit);
  const finalQuery = india ? `(${cleanQuery}) AND (AFF:"India" OR India)` : cleanQuery;
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(finalQuery)}&format=json&resultType=core&pageSize=${pageSize}`;
  const { data, cached } = await fetchJson(url);
  const results = data?.resultList?.result || [];

  return {
    source: 'Europe PMC',
    sourceUrl: 'https://europepmc.org/',
    query: finalQuery,
    hitCount: Number(data?.hitCount || 0),
    cached,
    results: results.map((item) => ({
      id: item.pmid || item.pmcid || item.doi || item.id,
      title: item.title || 'Untitled record',
      authors: item.authorString || '',
      journal: item.journalTitle || item.journalInfo?.journal?.title || '',
      year: item.pubYear || '',
      citedByCount: Number(item.citedByCount || 0),
      isOpenAccess: item.isOpenAccess === 'Y',
      doi: item.doi || null,
      pmid: item.pmid || null,
      pmcid: item.pmcid || null,
      url: item.pmcid
        ? `https://europepmc.org/article/PMC/${encodeURIComponent(item.pmcid.replace(/^PMC/i, ''))}`
        : item.pmid
          ? `https://europepmc.org/article/MED/${encodeURIComponent(item.pmid)}`
          : `https://europepmc.org/search?query=${encodeURIComponent(item.title || cleanQuery)}`
    }))
  };
}

const NCBI_DATABASES = {
  geo: { db: 'gds', label: 'NCBI GEO DataSets' },
  sra: { db: 'sra', label: 'NCBI SRA' },
  clinvar: { db: 'clinvar', label: 'NCBI ClinVar' }
};

export async function searchNcbi({ source = 'geo', query, india = false, limit = 15 }) {
  const selected = NCBI_DATABASES[source];
  if (!selected) throw badRequest('source must be geo, sra or clinvar.');
  const cleanQuery = sanitiseQuery(query);
  if (!cleanQuery) throw badRequest('Enter a study or variant search query.');
  const retmax = clampLimit(limit);
  const finalQuery = india ? `(${cleanQuery}) AND India[All Fields]` : cleanQuery;
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=${selected.db}&term=${encodeURIComponent(finalQuery)}&retmode=json&retmax=${retmax}&tool=${NCBI_TOOL}${NCBI_EMAIL}`;
  const searchResponse = await fetchJson(searchUrl);
  const ids = searchResponse.data?.esearchresult?.idlist || [];
  const hitCount = Number(searchResponse.data?.esearchresult?.count || 0);
  if (!ids.length) {
    return { source: selected.label, query: finalQuery, hitCount, cached: searchResponse.cached, results: [] };
  }

  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=${selected.db}&id=${ids.join(',')}&retmode=json&tool=${NCBI_TOOL}${NCBI_EMAIL}`;
  const summaryResponse = await fetchJson(summaryUrl);
  const resultRoot = summaryResponse.data?.result || {};
  const order = resultRoot.uids || ids;
  const results = order.map((id) => mapNcbiRecord(source, id, resultRoot[id] || {}));

  return {
    source: selected.label,
    sourceUrl: source === 'geo' ? 'https://www.ncbi.nlm.nih.gov/geo/' : source === 'sra' ? 'https://www.ncbi.nlm.nih.gov/sra' : 'https://www.ncbi.nlm.nih.gov/clinvar/',
    query: finalQuery,
    hitCount,
    cached: searchResponse.cached && summaryResponse.cached,
    results
  };
}

function mapNcbiRecord(source, id, item) {
  if (source === 'geo') {
    const accession = item.accession || item.gds || item.gse || id;
    return {
      id,
      accession,
      title: item.title || item.summary || `GEO record ${accession}`,
      summary: item.summary || '',
      organism: item.taxon || item.organism || '',
      date: item.pdat || item.pubdate || '',
      sampleCount: Number(item.n_samples || item.n_samples_total || 0) || null,
      url: `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${encodeURIComponent(accession)}`
    };
  }
  if (source === 'sra') {
    const accession = item.accession || item.runs?.[0]?.accession || id;
    return {
      id,
      accession,
      title: item.title || item.expxml?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240) || `SRA record ${accession}`,
      summary: item.study || item.biosample || '',
      organism: item.organism || '',
      date: item.createdate || item.updatedate || '',
      url: `https://www.ncbi.nlm.nih.gov/sra/?term=${encodeURIComponent(accession)}`
    };
  }
  const accession = item.accession || item.uid || id;
  return {
    id,
    accession,
    title: item.title || item.germline_classification?.description || `ClinVar record ${accession}`,
    summary: item.genes?.map((gene) => gene.symbol).filter(Boolean).join(', ') || '',
    organism: item.organism?.scientific_name || '',
    date: item.last_update_date || '',
    url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${encodeURIComponent(id)}/`
  };
}

export async function probePublicSources() {
  const probes = [
    {
      id: 'europe-pmc',
      name: 'Europe PMC',
      url: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=genomics&format=json&pageSize=1'
    },
    {
      id: 'ncbi-eutils',
      name: 'NCBI E-utilities',
      url: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gds&term=genomics&retmode=json&retmax=1&tool=${NCBI_TOOL}${NCBI_EMAIL}`
    }
  ];

  return await Promise.all(probes.map(async (probe) => {
    const started = Date.now();
    try {
      await fetchJson(probe.url, { timeoutMs: 5000 });
      return { id: probe.id, name: probe.name, status: 'available', latencyMs: Date.now() - started };
    } catch (error) {
      return { id: probe.id, name: probe.name, status: 'unavailable', latencyMs: Date.now() - started, message: error.message };
    }
  }));
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
