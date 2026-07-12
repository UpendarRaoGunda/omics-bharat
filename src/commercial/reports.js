import { randomUUID } from 'node:crypto';
import { checksum } from './workflows.js';

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function markdownEscape(value) {
  return cleanText(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function evidenceRow(resource, quality) {
  return {
    resourceId: resource.id,
    name: resource.name,
    organization: resource.organization,
    category: resource.category,
    scope: resource.scope,
    access: resource.access,
    url: resource.url,
    qualityScore: quality?.score ?? null,
    qualityGrade: quality?.grade ?? null,
    verifiedOn: resource.verifiedOn || null,
    role: 'supporting source',
    notes: null
  };
}

function buildMarkdown(report) {
  const lines = [
    `# ${report.title}`,
    '',
    `**Report ID:** ${report.id}`,
    `**Generated:** ${report.generatedAt}`,
    `**Research-use only:** Yes`,
    '',
    '## Research question',
    '',
    report.question,
    '',
    '## Scope',
    '',
    `- Disease/context: ${report.scope.disease || 'Not specified'}`,
    `- Target/biomarker: ${report.scope.target || 'Not specified'}`,
    `- Geography/population relevance: ${report.scope.geography || 'Not specified'}`,
    `- Decision context: ${report.scope.decisionContext || 'Not specified'}`,
    '',
    '## Executive summary',
    '',
    report.executiveSummary,
    '',
    '## Evidence sources',
    '',
    '| Source | Organisation | Scope | Access | Quality |',
    '|---|---|---|---|---|'
  ];

  for (const item of report.evidence) {
    lines.push(`| [${markdownEscape(item.name)}](${item.url}) | ${markdownEscape(item.organization)} | ${item.scope} | ${item.access} | ${item.qualityScore ?? 'Not scored'} |`);
  }

  lines.push('', '## Findings', '');
  if (report.findings.length) report.findings.forEach((item) => lines.push(`- ${cleanText(item)}`));
  else lines.push('- No findings were supplied.');

  lines.push('', '## Contradictory or uncertain evidence', '');
  if (report.contradictions.length) report.contradictions.forEach((item) => lines.push(`- ${cleanText(item)}`));
  else lines.push('- No contradictory evidence was documented; this does not prove that none exists.');

  lines.push('', '## Evidence gaps and next actions', '');
  report.gaps.forEach((item) => lines.push(`- ${cleanText(item)}`));

  lines.push('', '## Limitations', '');
  report.limitations.forEach((item) => lines.push(`- ${cleanText(item)}`));

  lines.push(
    '',
    '## Provenance',
    '',
    `- Generator: ${report.provenance.generator}`,
    `- Generator version: ${report.provenance.version}`,
    `- Catalog snapshot time: ${report.provenance.catalogSnapshotAt}`,
    `- Report checksum: ${report.checksum}`,
    '',
    '> This package supports scientific review. It is not a diagnosis, treatment recommendation, regulatory approval, or substitute for source-level review.'
  );
  return lines.join('\n');
}

export function createEvidencePackage(input = {}, context = {}) {
  const question = cleanText(input.question);
  if (!question) {
    const error = new Error('question is required.');
    error.statusCode = 400;
    throw error;
  }

  const selectedResources = list(context.resources);
  const qualityByResource = new Map(list(context.qualityProfiles).map((profile) => [profile.resourceId, profile.result || profile]));
  const evidence = selectedResources.map((resource) => evidenceRow(resource, qualityByResource.get(resource.id)));
  const findings = list(input.findings).map(cleanText);
  const contradictions = list(input.contradictions).map(cleanText);
  const userLimitations = list(input.limitations).map(cleanText);

  const gaps = [...new Set([
    ...(evidence.length ? [] : ['No source records were attached to this package.']),
    ...(evidence.some((item) => item.qualityScore === null) ? ['Score dataset suitability and metadata quality for all selected sources.'] : []),
    ...(!input.independentValidation ? ['Independent validation evidence has not been documented.'] : []),
    ...(!input.populationRelevance ? ['Population and cohort relevance require explicit review.'] : []),
    ...list(input.gaps).map(cleanText)
  ])];

  const report = {
    schema: 'https://omicsbharat.org/schemas/evidence-package/1.0.0',
    id: `report_${randomUUID()}`,
    organizationId: context.organizationId,
    projectId: input.projectId,
    createdBy: context.userId,
    generatedAt: new Date().toISOString(),
    title: cleanText(input.title, `Evidence package: ${question.slice(0, 80)}`),
    question,
    scope: {
      disease: cleanText(input.disease),
      target: cleanText(input.target),
      geography: cleanText(input.geography),
      decisionContext: cleanText(input.decisionContext)
    },
    executiveSummary: cleanText(
      input.executiveSummary,
      `This research-use package organizes ${evidence.length} selected public source${evidence.length === 1 ? '' : 's'} for the question: ${question}. It records supporting findings, contradictory evidence, quality gaps, and provenance without generating an unsupported biological conclusion.`
    ),
    evidence,
    findings,
    contradictions,
    gaps,
    limitations: [...new Set([
      ...userLimitations,
      'Public-resource metadata can be incomplete, stale or inconsistent with the underlying study.',
      'Association does not establish causality, clinical utility or treatment benefit.',
      'Indian and South Asian populations are heterogeneous; broad geographic labels are not substitutes for cohort characterization.',
      'All consequential claims require review of original records, methods and current evidence.'
    ])],
    decisionReadiness: {
      status: evidence.length && findings.length ? 'review-ready-draft' : 'incomplete-draft',
      sourceCount: evidence.length,
      scoredSourceCount: evidence.filter((item) => item.qualityScore !== null).length,
      contradictoryEvidenceDocumented: contradictions.length > 0,
      independentValidationDocumented: Boolean(input.independentValidation),
      populationRelevanceDocumented: Boolean(input.populationRelevance)
    },
    approvals: [],
    provenance: {
      generator: 'Omics Bharat Evidence Package Generator',
      version: '1.0.0',
      catalogSnapshotAt: context.catalogSnapshotAt || new Date().toISOString(),
      selectedResourceIds: evidence.map((item) => item.resourceId),
      deterministic: true,
      generatedFromUserSuppliedFindings: true
    },
    boundaries: {
      researchUseOnly: true,
      clinicalDecisionSupport: false,
      regulatoryApproval: false,
      automatedScientificConclusion: false
    }
  };

  report.checksum = checksum(report);
  report.markdown = buildMarkdown(report);
  return report;
}
