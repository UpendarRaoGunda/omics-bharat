const TABLES = Object.freeze({
  species: [
    { canonical: 'Homo sapiens', identifier: 'NCBITaxon:9606', synonyms: ['human', 'humans', 'h. sapiens', 'homo sapiens'] },
    { canonical: 'Mus musculus', identifier: 'NCBITaxon:10090', synonyms: ['mouse', 'mice', 'mus musculus'] },
    { canonical: 'Rattus norvegicus', identifier: 'NCBITaxon:10116', synonyms: ['rat', 'rats', 'rattus norvegicus'] }
  ],
  tissue: [
    { canonical: 'blood', identifier: 'UBERON:0000178', synonyms: ['blood', 'whole blood', 'peripheral blood'] },
    { canonical: 'liver', identifier: 'UBERON:0002107', synonyms: ['liver', 'hepatic tissue'] },
    { canonical: 'lung', identifier: 'UBERON:0002048', synonyms: ['lung', 'pulmonary tissue'] },
    { canonical: 'brain', identifier: 'UBERON:0000955', synonyms: ['brain', 'brain tissue'] },
    { canonical: 'kidney', identifier: 'UBERON:0002113', synonyms: ['kidney', 'renal tissue'] },
    { canonical: 'heart', identifier: 'UBERON:0000948', synonyms: ['heart', 'cardiac tissue', 'myocardium'] }
  ],
  assay: [
    { canonical: 'RNA sequencing', identifier: 'OB-ASSAY:RNA_SEQ', synonyms: ['rna-seq', 'rna seq', 'rnaseq', 'rna sequencing', 'transcriptome sequencing'] },
    { canonical: 'whole genome sequencing', identifier: 'OB-ASSAY:WGS', synonyms: ['wgs', 'whole-genome sequencing', 'whole genome sequencing'] },
    { canonical: 'whole exome sequencing', identifier: 'OB-ASSAY:WES', synonyms: ['wes', 'whole-exome sequencing', 'whole exome sequencing'] },
    { canonical: 'single-cell RNA sequencing', identifier: 'OB-ASSAY:SCRNA_SEQ', synonyms: ['scrna-seq', 'single cell rna-seq', 'single-cell rna sequencing'] },
    { canonical: 'ATAC sequencing', identifier: 'OB-ASSAY:ATAC_SEQ', synonyms: ['atac-seq', 'atac seq', 'assay for transposase-accessible chromatin'] },
    { canonical: 'mass spectrometry proteomics', identifier: 'OB-ASSAY:MS_PROTEOMICS', synonyms: ['lc-ms/ms', 'mass spectrometry', 'proteomics mass spectrometry'] }
  ],
  disease: [
    { canonical: 'breast cancer', identifier: null, synonyms: ['breast cancer', 'breast carcinoma', 'mammary carcinoma'] },
    { canonical: 'oral squamous cell carcinoma', identifier: null, synonyms: ['oscc', 'oral squamous cell carcinoma', 'oral cancer'] },
    { canonical: 'tuberculosis', identifier: null, synonyms: ['tb', 'tuberculosis'] },
    { canonical: 'type 2 diabetes mellitus', identifier: null, synonyms: ['t2d', 't2dm', 'type 2 diabetes', 'type ii diabetes mellitus'] }
  ],
  unit: [
    { canonical: 'milligram per decilitre', identifier: 'UCUM:mg/dL', synonyms: ['mg/dl', 'mg per dl', 'milligram/deciliter'] },
    { canonical: 'micromole per litre', identifier: 'UCUM:umol/L', synonyms: ['µmol/l', 'umol/l', 'micromolar'] },
    { canonical: 'nanogram per millilitre', identifier: 'UCUM:ng/mL', synonyms: ['ng/ml', 'nanogram/ml'] }
  ]
});

function normalise(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

function buildCustomTable(customMappings = {}) {
  const result = {};
  for (const [field, mappings] of Object.entries(customMappings || {})) {
    if (!Array.isArray(mappings)) continue;
    result[field] = mappings
      .filter((item) => item && item.canonical && Array.isArray(item.synonyms))
      .map((item) => ({
        canonical: String(item.canonical),
        identifier: item.identifier ? String(item.identifier) : null,
        synonyms: item.synonyms.map(String)
      }));
  }
  return result;
}

function mapValue(field, value, customTables) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return {
      field,
      original: value,
      canonical: null,
      identifier: null,
      status: 'missing',
      confidence: 0,
      mappingSource: null,
      reviewRequired: true
    };
  }

  const input = normalise(value);
  const candidates = [...(customTables[field] || []), ...(TABLES[field] || [])];
  for (const candidate of candidates) {
    const canonicalMatch = normalise(candidate.canonical) === input;
    const synonymMatch = candidate.synonyms.some((synonym) => normalise(synonym) === input);
    if (canonicalMatch || synonymMatch) {
      const isCustom = (customTables[field] || []).includes(candidate);
      return {
        field,
        original: value,
        canonical: candidate.canonical,
        identifier: candidate.identifier || null,
        status: canonicalMatch ? 'canonical' : 'mapped',
        confidence: canonicalMatch ? 1 : 0.95,
        mappingSource: isCustom ? 'organization mapping' : candidate.identifier?.startsWith('OB-') ? 'Omics Bharat controlled vocabulary' : 'curated public ontology mapping',
        reviewRequired: !candidate.identifier && field !== 'disease'
      };
    }
  }

  return {
    field,
    original: value,
    canonical: String(value).trim(),
    identifier: null,
    status: 'unmapped',
    confidence: 0,
    mappingSource: null,
    reviewRequired: true
  };
}

export function harmonizeRecord(record = {}, options = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    const error = new TypeError('The harmonization input must be a JSON object.');
    error.statusCode = 400;
    throw error;
  }

  const customTables = buildCustomTable(options.customMappings);
  const requestedFields = options.fields || ['disease', 'tissue', 'species', 'assay', 'unit'];
  const mappings = requestedFields.map((field) => mapValue(field, record[field], customTables));
  const harmonized = { ...record };

  for (const mapping of mappings) {
    if (mapping.canonical !== null) harmonized[mapping.field] = mapping.canonical;
    if (mapping.identifier) harmonized[`${mapping.field}Id`] = mapping.identifier;
  }

  return {
    original: structuredClone(record),
    harmonized,
    mappings,
    reviewRequired: mappings.some((item) => item.reviewRequired),
    unmappedFields: mappings.filter((item) => item.status === 'unmapped' || item.status === 'missing').map((item) => item.field),
    provenance: {
      engine: 'Omics Bharat Harmonization Engine',
      version: '1.0.0',
      ruleBased: true,
      transformedAt: new Date().toISOString(),
      principle: 'Original values are preserved alongside every normalized value and mapping decision.'
    },
    boundaries: [
      'Automatic mappings require scientific review before consequential use.',
      'Geography, language, caste, tribe, recruitment site and ancestry are distinct concepts and must not be substituted for one another.',
      'Internal OB-ASSAY identifiers are product vocabulary labels, not external ontology assertions.'
    ]
  };
}

export function harmonizationCapabilities() {
  return {
    version: '1.0.0',
    fields: Object.keys(TABLES),
    publicOntologyNamespaces: ['NCBITaxon', 'UBERON', 'UCUM'],
    internalNamespaces: ['OB-ASSAY'],
    customOrganizationMappings: true,
    preservesOriginalValues: true,
    requiresHumanReview: true
  };
}
