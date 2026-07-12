import { readFile, readdir } from 'node:fs/promises';

const baseResourceUrl = new URL('../data/resources.json', import.meta.url);
const resourceDirectoryUrl = new URL('../data/resources/', import.meta.url);
let resourcePromise;

const categoryRules = [
  ['policy', 'Public health & policy'],
  ['standards', 'Standards & ontologies'],
  ['ontology', 'Standards & ontologies'],
  ['training', 'Training & compute'],
  ['compute', 'Training & compute'],
  ['software', 'Open-source software'],
  ['workflow', 'Open-source software'],
  ['literature', 'Literature & evidence'],
  ['registry', 'Disease & clinical evidence'],
  ['institute', 'Indian public infrastructure'],
  ['project', 'Indian public infrastructure']
];

function inferCategory(resource) {
  if (resource.category) return resource.category;
  const kind = normalise(resource.kind);
  const explicit = categoryRules.find(([needle]) => kind === needle);
  if (explicit) return explicit[1];

  const terms = [resource.name, resource.description, ...(resource.omics || []), ...(resource.tags || [])]
    .join(' ')
    .toLowerCase();
  if (/single-cell|transcript|expression|epigen/.test(terms)) return 'Expression & single-cell';
  if (/protein|proteom|structure|cryo-em|domain/.test(terms)) return 'Proteins & structures';
  if (/metabol|chemical|drug|pharmaco|lipid|compound/.test(terms)) return 'Metabolomics & chemistry';
  if (/microbi|bacteria|pathogen|taxonomy|biodiversity/.test(terms)) return 'Microbiome & biodiversity';
  if (/pathway|interaction|network|ontology/.test(terms)) return 'Pathways & interactions';
  if (/clinical|disease|variant|phenotype|cancer|trial/.test(terms)) return 'Disease & clinical evidence';
  if (/genom|sequence|assembly|repository/.test(terms)) return 'Sequence & genomes';
  return resource.scope === 'India' ? 'Indian public infrastructure' : 'General life-science resources';
}

function normaliseResource(resource, source) {
  return {
    ...resource,
    category: inferCategory(resource),
    api: Boolean(resource.api),
    openSource: Boolean(resource.openSource),
    sourceFile: source
  };
}

async function loadJson(url) {
  const text = await readFile(url, 'utf8');
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new TypeError(`Catalog file must contain an array: ${url.pathname}`);
  return parsed;
}

async function loadResources() {
  const base = await loadJson(baseResourceUrl);
  let names = [];
  try {
    names = (await readdir(resourceDirectoryUrl)).filter((name) => name.endsWith('.json')).sort();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const shards = await Promise.all(names.map(async (name) => ({
    name,
    resources: await loadJson(new URL(name, resourceDirectoryUrl))
  })));

  const combined = [
    ...base.map((resource) => normaliseResource(resource, 'resources.json')),
    ...shards.flatMap(({ name, resources }) => resources.map((resource) => normaliseResource(resource, name)))
  ];

  const ids = new Set();
  for (const resource of combined) {
    if (!resource.id || !resource.name || !resource.url) {
      throw new TypeError(`Catalog resource is missing id, name or url in ${resource.sourceFile}`);
    }
    if (ids.has(resource.id)) throw new TypeError(`Duplicate catalog resource id: ${resource.id}`);
    ids.add(resource.id);
  }

  return combined.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'India' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getResources() {
  resourcePromise ||= loadResources();
  return resourcePromise;
}

function normalise(value) {
  return String(value || '').trim().toLowerCase();
}

function parseBooleanFilter(value) {
  const normalised = normalise(value);
  if (!normalised) return null;
  return ['1', 'true', 'yes'].includes(normalised);
}

export function filterResources(resources, filters = {}) {
  const query = normalise(filters.query);
  const kind = normalise(filters.kind);
  const category = normalise(filters.category);
  const omics = normalise(filters.omics);
  const scope = normalise(filters.scope);
  const region = normalise(filters.region);
  const access = normalise(filters.access);
  const api = parseBooleanFilter(filters.api);
  const openSource = parseBooleanFilter(filters.openSource);

  return resources.filter((resource) => {
    const haystack = [
      resource.name,
      resource.organization,
      resource.description,
      resource.state,
      resource.region,
      resource.scope,
      resource.kind,
      resource.category,
      resource.access,
      resource.license,
      ...(resource.omics || []),
      ...(resource.tags || [])
    ].join(' ').toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (kind && normalise(resource.kind) !== kind) return false;
    if (category && normalise(resource.category) !== category) return false;
    if (scope && normalise(resource.scope) !== scope) return false;
    if (region && normalise(resource.region) !== region) return false;
    if (access && normalise(resource.access) !== access) return false;
    if (omics && !(resource.omics || []).some((item) => normalise(item).includes(omics))) return false;
    if (api !== null && resource.api !== api) return false;
    if (openSource !== null && resource.openSource !== openSource) return false;
    return true;
  });
}

export function catalogFacets(resources) {
  const unique = (items) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    kinds: unique(resources.map((item) => item.kind)),
    categories: unique(resources.map((item) => item.category)),
    omics: unique(resources.flatMap((item) => item.omics || [])),
    scopes: unique(resources.map((item) => item.scope)),
    regions: unique(resources.map((item) => item.region)),
    access: unique(resources.map((item) => item.access)),
    capabilities: {
      api: resources.filter((item) => item.api).length,
      openSource: resources.filter((item) => item.openSource).length
    }
  };
}
