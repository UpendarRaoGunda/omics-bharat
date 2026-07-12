import { createHash, createHmac, randomUUID } from 'node:crypto';

const WORKFLOWS = Object.freeze([
  {
    id: 'public-evidence-review',
    name: 'Public evidence review',
    engine: 'Omics Bharat',
    category: 'evidence',
    purpose: 'Build a cited evidence package from selected public resources without executing a biological pipeline.',
    inputTypes: ['catalog resource IDs', 'research question', 'structured findings'],
    outputs: ['evidence package JSON', 'Markdown report', 'provenance checksum'],
    registryUrl: '/api/v1/workflows/public-evidence-review',
    versionPolicy: 'Platform release is pinned automatically.',
    researchUseOnly: true
  },
  {
    id: 'nf-core-rnaseq',
    name: 'RNA-seq analysis',
    engine: 'Nextflow',
    category: 'transcriptomics',
    purpose: 'Quality control, alignment or pseudo-alignment, quantification and reporting for bulk RNA sequencing.',
    inputTypes: ['FASTQ', 'sample sheet', 'reference genome and annotation'],
    outputs: ['quality reports', 'counts', 'alignment files', 'run manifest'],
    registryUrl: 'https://nf-co.re/rnaseq',
    versionPolicy: 'A pipeline release, container digest and reference bundle must be pinned before execution.',
    researchUseOnly: true
  },
  {
    id: 'nf-core-sarek',
    name: 'Germline and somatic variant analysis',
    engine: 'Nextflow',
    category: 'genomics',
    purpose: 'Research-use germline or somatic variant workflow orchestration with explicit reference and caller configuration.',
    inputTypes: ['FASTQ or BAM/CRAM', 'sample sheet', 'reference bundle'],
    outputs: ['QC', 'aligned reads', 'research VCFs', 'run manifest'],
    registryUrl: 'https://nf-co.re/sarek',
    versionPolicy: 'A pipeline release, callers, containers and reference bundle must be pinned before execution.',
    researchUseOnly: true
  },
  {
    id: 'nf-core-scrnaseq',
    name: 'Single-cell RNA-seq preprocessing',
    engine: 'Nextflow',
    category: 'single-cell',
    purpose: 'Research-use preprocessing and quantification for supported single-cell RNA-seq technologies.',
    inputTypes: ['FASTQ', 'sample sheet', 'reference genome and annotation'],
    outputs: ['cell-by-gene matrices', 'QC', 'run manifest'],
    registryUrl: 'https://nf-co.re/scrnaseq',
    versionPolicy: 'Pipeline, quantifier, chemistry assumptions and reference bundle must be pinned.',
    researchUseOnly: true
  },
  {
    id: 'nf-core-atacseq',
    name: 'ATAC-seq analysis',
    engine: 'Nextflow',
    category: 'epigenomics',
    purpose: 'Research-use chromatin accessibility quality control, alignment and peak analysis.',
    inputTypes: ['FASTQ', 'sample sheet', 'reference genome'],
    outputs: ['QC', 'peaks', 'coverage tracks', 'run manifest'],
    registryUrl: 'https://nf-co.re/atacseq',
    versionPolicy: 'Pipeline, containers and reference bundle must be pinned.',
    researchUseOnly: true
  },
  {
    id: 'nf-core-methylseq',
    name: 'DNA methylation sequencing analysis',
    engine: 'Nextflow',
    category: 'epigenomics',
    purpose: 'Research-use bisulfite sequencing quality control, alignment and methylation calling.',
    inputTypes: ['FASTQ', 'sample sheet', 'reference genome'],
    outputs: ['QC', 'methylation calls', 'coverage files', 'run manifest'],
    registryUrl: 'https://nf-co.re/methylseq',
    versionPolicy: 'Pipeline, aligner, containers and reference bundle must be pinned.',
    researchUseOnly: true
  },
  {
    id: 'nf-core-mag',
    name: 'Metagenome assembly and analysis',
    engine: 'Nextflow',
    category: 'microbiome',
    purpose: 'Research-use metagenomic assembly, binning and taxonomic analysis.',
    inputTypes: ['FASTQ', 'sample sheet', 'database bundle'],
    outputs: ['assemblies', 'bins', 'taxonomic profiles', 'QC', 'run manifest'],
    registryUrl: 'https://nf-co.re/mag',
    versionPolicy: 'Pipeline, containers and database snapshots must be pinned.',
    researchUseOnly: true
  },
  {
    id: 'nf-core-proteomicslfq',
    name: 'Label-free proteomics analysis',
    engine: 'Nextflow',
    category: 'proteomics',
    purpose: 'Research-use mass-spectrometry proteomics identification and label-free quantification.',
    inputTypes: ['mass-spectrometry files', 'experimental design', 'protein sequence database'],
    outputs: ['identifications', 'quantification', 'QC', 'run manifest'],
    registryUrl: 'https://nf-co.re/proteomicslfq',
    versionPolicy: 'Pipeline, search engine, containers and protein database must be pinned.',
    researchUseOnly: true
  }
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function checksum(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

export function workflowRegistry() {
  return WORKFLOWS.map((workflow) => structuredClone(workflow));
}

export function findWorkflow(id) {
  const workflow = WORKFLOWS.find((item) => item.id === id);
  return workflow ? structuredClone(workflow) : null;
}

function required(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    const error = new Error(`${label} is required.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

export function createRunManifest(input = {}, context = {}) {
  const workflow = findWorkflow(required(input.workflowId, 'workflowId'));
  if (!workflow) {
    const error = new Error('Unknown workflowId.');
    error.statusCode = 404;
    throw error;
  }

  const pinningRequired = workflow.engine !== 'Omics Bharat';
  const pins = {
    workflowVersion: input.workflowVersion || null,
    workflowCommit: input.workflowCommit || null,
    containerDigests: input.containerDigests || {},
    referenceBundle: input.referenceBundle || null,
    annotationVersion: input.annotationVersion || null
  };
  const missingPins = pinningRequired
    ? Object.entries(pins).filter(([key, value]) => key !== 'annotationVersion' && (!value || (typeof value === 'object' && Object.keys(value).length === 0))).map(([key]) => key)
    : [];

  if (input.containsHumanData === true && context.allowPrivateHumanData !== true) {
    const error = new Error('This deployment is not configured to accept private human genomic data. Use accession references or an approved private deployment.');
    error.statusCode = 403;
    throw error;
  }

  const manifest = {
    manifestVersion: '1.0.0',
    id: `run_${randomUUID()}`,
    organizationId: context.organizationId,
    projectId: required(input.projectId, 'projectId'),
    createdBy: context.userId,
    createdAt: new Date().toISOString(),
    status: missingPins.length ? 'draft-needs-pinning' : 'draft-ready',
    researchUseOnly: true,
    workflow,
    pins,
    missingPins,
    inputs: input.inputs || [],
    parameters: input.parameters || {},
    outputsRequested: input.outputsRequested || workflow.outputs,
    dataClassification: input.dataClassification || 'public-or-deidentified-research',
    containsHumanData: Boolean(input.containsHumanData),
    approvals: [],
    environment: {
      executor: context.executor || 'manifest',
      deploymentRegion: context.deploymentRegion || 'unspecified'
    },
    boundaries: [
      'A drafted manifest does not certify pipeline validity or regulatory fitness.',
      'Execution requires pinned versions, references and containers.',
      'Research outputs require scientific review before consequential use.'
    ]
  };
  manifest.checksum = checksum(manifest);
  return manifest;
}

export async function dispatchRun(manifest, config) {
  if (manifest.missingPins?.length) {
    return { status: 'draft-needs-pinning', dispatched: false, missingPins: manifest.missingPins };
  }
  if (config.workflowExecutor !== 'webhook') {
    return { status: 'manifest-ready', dispatched: false, executor: config.workflowExecutor };
  }
  if (!config.workflowWebhookUrl || !config.workflowWebhookSecret) {
    const error = new Error('Workflow webhook execution requires WORKFLOW_WEBHOOK_URL and WORKFLOW_WEBHOOK_SECRET.');
    error.statusCode = 503;
    throw error;
  }

  const body = JSON.stringify(manifest);
  const signature = createHmac('sha256', config.workflowWebhookSecret).update(body).digest('hex');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(config.workflowWebhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-omics-bharat-signature': `sha256=${signature}`,
        'x-omics-bharat-run-id': manifest.id
      },
      body,
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`Workflow executor returned ${response.status}.`);
      error.statusCode = 502;
      error.detail = text.slice(0, 500);
      throw error;
    }
    let remote = {};
    try { remote = text ? JSON.parse(text) : {}; } catch { remote = { message: text.slice(0, 500) }; }
    return { status: 'submitted', dispatched: true, remote };
  } finally {
    clearTimeout(timeout);
  }
}
