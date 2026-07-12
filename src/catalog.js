import { readFile } from 'node:fs/promises';

const resourceUrl = new URL('../data/resources.json', import.meta.url);
let resourcePromise;

export async function getResources() {
  resourcePromise ||= readFile(resourceUrl, 'utf8').then(JSON.parse);
  return resourcePromise;
}

function normalise(value) {
  return String(value || '').trim().toLowerCase();
}

export function filterResources(resources, filters = {}) {
  const query = normalise(filters.query);
  const kind = normalise(filters.kind);
  const omics = normalise(filters.omics);
  const scope = normalise(filters.scope);
  const region = normalise(filters.region);
  const access = normalise(filters.access);

  return resources.filter((resource) => {
    const haystack = [
      resource.name,
      resource.organization,
      resource.description,
      resource.state,
      resource.region,
      resource.scope,
      resource.kind,
      resource.access,
      ...(resource.omics || []),
      ...(resource.tags || [])
    ].join(' ').toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (kind && normalise(resource.kind) !== kind) return false;
    if (scope && normalise(resource.scope) !== scope) return false;
    if (region && normalise(resource.region) !== region) return false;
    if (access && normalise(resource.access) !== access) return false;
    if (omics && !(resource.omics || []).some((item) => normalise(item).includes(omics))) return false;
    return true;
  });
}

export function catalogFacets(resources) {
  const unique = (items) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    kinds: unique(resources.map((item) => item.kind)),
    omics: unique(resources.flatMap((item) => item.omics || [])),
    scopes: unique(resources.map((item) => item.scope)),
    regions: unique(resources.map((item) => item.region)),
    access: unique(resources.map((item) => item.access))
  };
}
