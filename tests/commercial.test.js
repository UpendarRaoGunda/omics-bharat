import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDatasetQuality } from '../src/commercial/quality.js';
import { harmonizeRecord } from '../src/commercial/harmonize.js';
import { checksum, createRunManifest } from '../src/commercial/workflows.js';
import { createEvidencePackage } from '../src/commercial/reports.js';


test('dataset quality profile is transparent and component based', () => {
  const result = evaluateDatasetQuality({
    title: 'Demo cohort',
    description: 'Research dataset',
    disease: 'oral cancer',
    tissue: 'blood',
    species: 'Homo sapiens',
    assay: 'RNA-seq',
    sampleSize: 120,
    groups: ['case', 'control'],
    platform: 'NovaSeq',
    publication: 'PMID demo',
    accession: 'GSE-DEMO',
    contact: 'research@example.org',
    source: 'GEO',
    sourceUrl: 'https://example.org',
    retrievedAt: '2026-01-01',
    version: '1',
    geography: 'India',
    ancestryDescription: 'Recruitment and self-described population metadata reviewed',
    access: 'controlled',
    license: 'research use',
    consent: 'documented',
    ethicsApproval: 'documented',
    humanData: true,
    qualityControl: 'reviewed',
    batchInformation: 'documented',
    workflow: {
      name: 'nf-core/rnaseq',
      version: 'pinned',
      codeUrl: 'https://example.org',
      commit: 'abc123',
      containerDigest: 'sha256:demo',
      parameters: {},
      referenceFiles: [],
      logs: 'available',
      outputChecksums: {},
      environment: 'container'
    }
  });
  assert.equal(result.components.length, 6);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(result.formula.reduce((sum, item) => sum + item.weight, 0), 1);
  assert.match(result.boundaries.join(' '), /not an AI confidence score/i);
});


test('harmonization preserves original values and flags review', () => {
  const result = harmonizeRecord({ species: 'human', tissue: 'whole blood', assay: 'rnaseq', disease: 'oral cancer' });
  assert.equal(result.original.species, 'human');
  assert.equal(result.harmonized.species, 'Homo sapiens');
  assert.equal(result.harmonized.speciesId, 'NCBITaxon:9606');
  assert.equal(result.harmonized.tissueId, 'UBERON:0000178');
  assert.ok(Array.isArray(result.mappings));
});


test('workflow manifests expose missing pins and immutable checksum', () => {
  const manifest = createRunManifest({
    workflowId: 'nf-core-rnaseq',
    projectId: 'prj_test',
    inputs: [{ type: 'accession', value: 'GSE-DEMO' }]
  }, {
    organizationId: 'org_test',
    userId: 'usr_test',
    allowPrivateHumanData: false,
    executor: 'manifest',
    deploymentRegion: 'test'
  });
  assert.equal(manifest.status, 'draft-needs-pinning');
  assert.ok(manifest.missingPins.includes('workflowVersion'));
  assert.equal(manifest.checksum.length, 64);
  assert.equal(checksum({ b: 2, a: 1 }), checksum({ a: 1, b: 2 }));
});


test('evidence package records contradictions limitations and provenance', () => {
  const report = createEvidencePackage({
    projectId: 'prj_test',
    question: 'Is target X supported?',
    disease: 'oral cancer',
    target: 'X',
    findings: ['Expression is elevated in one cohort.'],
    contradictions: ['A second cohort shows no change.'],
    independentValidation: false,
    populationRelevance: false
  }, {
    organizationId: 'org_test',
    userId: 'usr_test',
    resources: [{
      id: 'source-1',
      name: 'Source 1',
      organization: 'Example',
      category: 'Expression',
      scope: 'Global',
      access: 'open',
      url: 'https://example.org',
      verifiedOn: '2026-01-01'
    }],
    qualityProfiles: []
  });
  assert.equal(report.evidence.length, 1);
  assert.equal(report.contradictions.length, 1);
  assert.ok(report.gaps.length >= 2);
  assert.equal(report.checksum.length, 64);
  assert.match(report.markdown, /Contradictory or uncertain evidence/);
});
