const COMPONENTS = Object.freeze([
  { id: 'metadata', label: 'Metadata completeness', weight: 0.25 },
  { id: 'provenance', label: 'Provenance and versioning', weight: 0.20 },
  { id: 'cohort', label: 'Cohort and study suitability', weight: 0.15 },
  { id: 'assay', label: 'Assay and analytical quality', weight: 0.15 },
  { id: 'reproducibility', label: 'Reproducibility', weight: 0.15 },
  { id: 'governance', label: 'Governance and reuse readiness', weight: 0.10 }
]);

function present(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function get(record, path) {
  return path.split('.').reduce((value, key) => value?.[key], record);
}

function scoreFields(record, fields) {
  const evidence = fields.map((field) => ({ field, present: present(get(record, field)) }));
  const completed = evidence.filter((item) => item.present).length;
  return {
    score: Math.round((completed / fields.length) * 100),
    evidence,
    missing: evidence.filter((item) => !item.present).map((item) => item.field)
  };
}

function cap(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function grade(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

function componentMetadata(record) {
  return scoreFields(record, [
    'title', 'description', 'disease', 'tissue', 'species', 'assay',
    'sampleSize', 'groups', 'platform', 'publication', 'accession', 'contact'
  ]);
}

function componentProvenance(record) {
  const result = scoreFields(record, [
    'source', 'accession', 'sourceUrl', 'retrievedAt', 'version',
    'checksum', 'referenceBuild', 'annotationVersion'
  ]);
  if (record.accession && record.sourceUrl) result.score = cap(result.score + 5);
  return result;
}

function componentCohort(record) {
  const result = scoreFields(record, [
    'sampleSize', 'groups', 'caseDefinition', 'controlDefinition',
    'inclusionCriteria', 'exclusionCriteria', 'ageSummary', 'sexSummary',
    'geography', 'ancestryDescription', 'treatmentContext', 'confounders'
  ]);
  const sampleSize = Number(record.sampleSize);
  if (Number.isFinite(sampleSize) && sampleSize >= 100) result.score = cap(result.score + 8);
  if (record.geography && !record.ancestryDescription) {
    result.score = cap(result.score - 5);
    result.missing.push('ancestryDescription');
  }
  return result;
}

function componentAssay(record) {
  const result = scoreFields(record, [
    'assay', 'platform', 'libraryPreparation', 'protocol', 'qualityControl',
    'batchInformation', 'referenceBuild', 'normalization', 'detectionLimits', 'replicates'
  ]);
  if (record.qualityControl && record.batchInformation) result.score = cap(result.score + 5);
  return result;
}

function componentReproducibility(record) {
  const result = scoreFields(record, [
    'workflow.name', 'workflow.version', 'workflow.codeUrl', 'workflow.commit',
    'workflow.containerDigest', 'workflow.parameters', 'workflow.referenceFiles',
    'workflow.logs', 'workflow.outputChecksums', 'workflow.environment'
  ]);
  if (record.workflow?.commit && record.workflow?.containerDigest) result.score = cap(result.score + 8);
  return result;
}

function componentGovernance(record) {
  const result = scoreFields(record, [
    'access', 'license', 'consent', 'ethicsApproval', 'dataUseConditions',
    'retentionPolicy', 'deidentification', 'dataController', 'commercialUse', 'withdrawalProcess'
  ]);
  if (record.humanData === false) {
    result.score = cap(result.score + 15);
    result.missing = result.missing.filter((field) => !['consent', 'ethicsApproval', 'withdrawalProcess'].includes(field));
  }
  if (record.humanData === true && (!record.consent || !record.ethicsApproval)) result.score = cap(result.score - 20);
  return result;
}

const CALCULATORS = Object.freeze({
  metadata: componentMetadata,
  provenance: componentProvenance,
  cohort: componentCohort,
  assay: componentAssay,
  reproducibility: componentReproducibility,
  governance: componentGovernance
});

export function evaluateDatasetQuality(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    const error = new TypeError('Dataset metadata must be a JSON object.');
    error.statusCode = 400;
    throw error;
  }

  const components = COMPONENTS.map((definition) => {
    const result = CALCULATORS[definition.id](input);
    return {
      ...definition,
      score: cap(result.score),
      weightedScore: Number((cap(result.score) * definition.weight).toFixed(2)),
      evidence: result.evidence,
      missing: [...new Set(result.missing)]
    };
  });

  const total = cap(components.reduce((sum, component) => sum + component.weightedScore, 0));
  const missing = [...new Set(components.flatMap((component) => component.missing))];
  const warnings = [];

  if (input.humanData === true && !input.consent) warnings.push('Human-data consent information is missing.');
  if (input.humanData === true && !input.ethicsApproval) warnings.push('Human-data ethics approval information is missing.');
  if (input.geography && !input.ancestryDescription) warnings.push('Geography must not be used as a substitute for ancestry or population description.');
  if (!input.license && !input.dataUseConditions) warnings.push('Reuse and commercial-use conditions are not documented.');
  if (!input.workflow?.version || !input.workflow?.containerDigest) warnings.push('The analysis environment is not fully pinned.');

  const actions = missing.slice(0, 12).map((field) => ({
    field,
    action: `Provide or verify ${field.replaceAll('.', ' / ')}.`
  }));

  return {
    framework: 'Omics Bharat Dataset Quality Profile',
    frameworkVersion: '1.0.0',
    score: total,
    grade: grade(total),
    interpretation: total >= 85
      ? 'Strong reuse readiness, subject to scientific review.'
      : total >= 70
        ? 'Generally usable with documented gaps.'
        : total >= 55
          ? 'Use with caution and resolve important gaps.'
          : 'Insufficiently documented for high-confidence reuse.',
    components,
    warnings,
    priorityActions: actions,
    formula: COMPONENTS.map(({ id, label, weight }) => ({ id, label, weight })),
    boundaries: [
      'This profile is transparent and deterministic; it is not an AI confidence score.',
      'It does not establish analytical validity, clinical validity, regulatory compliance or fitness for diagnosis.',
      'A high score cannot compensate for an unsuitable cohort, biased design or incorrect scientific question.'
    ],
    evaluatedAt: new Date().toISOString()
  };
}

export function qualityFramework() {
  return {
    name: 'Omics Bharat Dataset Quality Profile',
    version: '1.0.0',
    components: COMPONENTS,
    scoring: 'Weighted deterministic completion and evidence checks with explicit deductions.',
    clinicalUse: false
  };
}
