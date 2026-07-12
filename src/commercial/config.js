const truthy = new Set(['1', 'true', 'yes', 'on']);

function asBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return truthy.has(String(value).trim().toLowerCase());
}

function asInteger(value, fallback, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

export const PRODUCT_PLANS = Object.freeze([
  {
    id: 'community',
    name: 'Community',
    audience: 'Students, independent researchers and public discovery',
    price: 'Free',
    commercial: false,
    limits: { seats: 1, projects: 0, savedSearches: 10, monthlyRuns: 0, storageGb: 0 },
    features: [
      'Curated public-resource catalog',
      'Live NCBI and Europe PMC search',
      'Lightweight transient file checks',
      'Public API with fair-use limits'
    ]
  },
  {
    id: 'research-team',
    name: 'Research Team',
    audience: 'Biotech, CRO and academic translational teams',
    price: 'Contact sales',
    commercial: true,
    limits: { seats: 15, projects: 25, savedSearches: 250, monthlyRuns: 100, storageGb: 500 },
    features: [
      'Private organizations and projects',
      'Dataset quality profiles',
      'Metadata harmonization and provenance',
      'Reproducible workflow manifests',
      'Decision-ready evidence packages',
      'API keys and audit history'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'Pharma, diagnostics networks and large research organizations',
    price: 'Custom annual contract',
    commercial: true,
    limits: { seats: -1, projects: -1, savedSearches: -1, monthlyRuns: -1, storageGb: -1 },
    features: [
      'SSO/SCIM integration boundary',
      'Private cloud, VPC and on-prem deployment patterns',
      'Customer-managed storage and encryption-key integration',
      'Custom data connectors and workflow adapters',
      'Service-level objectives and premium support',
      'Security, governance and validation documentation'
    ]
  },
  {
    id: 'regulated',
    name: 'Regulated',
    audience: 'Qualified research and regulated-computing environments',
    price: 'Qualification engagement required',
    commercial: true,
    limits: { seats: -1, projects: -1, savedSearches: -1, monthlyRuns: -1, storageGb: -1 },
    features: [
      'Controlled releases and change records',
      'Electronic review and approval workflow boundary',
      'Immutable audit-export design',
      'Installation and operational qualification templates',
      'Customer-specific validation and SOP support',
      'No automatic claim of regulatory compliance'
    ]
  }
]);

export function getCommercialConfig(env = process.env) {
  const mode = String(env.COMMERCIAL_MODE || 'demo').trim().toLowerCase();
  const demoEnabled = mode === 'demo' && asBoolean(env.COMMERCIAL_DEMO, true);
  const sessionSecret = String(
    env.OMICS_SESSION_SECRET ||
    (demoEnabled ? 'omics-bharat-public-demo-v3-not-for-production' : '')
  );

  return {
    mode,
    enabled: mode !== 'off' && mode !== 'disabled',
    demoEnabled,
    sessionSecret,
    sessionTtlSeconds: asInteger(env.OMICS_SESSION_TTL_HOURS, 12, 1, 168) * 3600,
    dataDir: String(env.OMICS_DATA_DIR || '').trim(),
    bootstrapAdminEmail: String(env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase(),
    bootstrapAdminPassword: String(env.BOOTSTRAP_ADMIN_PASSWORD || ''),
    workflowExecutor: String(env.WORKFLOW_EXECUTOR || 'manifest').trim().toLowerCase(),
    workflowWebhookUrl: String(env.WORKFLOW_WEBHOOK_URL || '').trim(),
    workflowWebhookSecret: String(env.WORKFLOW_WEBHOOK_SECRET || '').trim(),
    allowPrivateHumanData: asBoolean(env.ALLOW_PRIVATE_HUMAN_DATA, false),
    deploymentRegion: String(env.DEPLOYMENT_REGION || 'unspecified'),
    supportContact: String(env.SUPPORT_CONTACT || 'support@omicsbharat.example'),
    productPlans: PRODUCT_PLANS
  };
}

export function assertCommercialConfiguration(config) {
  if (!config.enabled) return;
  if (!config.sessionSecret) {
    const error = new Error('OMICS_SESSION_SECRET is required when commercial mode is enabled outside demo mode.');
    error.statusCode = 503;
    throw error;
  }
  if (config.mode === 'production' && (!config.bootstrapAdminEmail || !config.bootstrapAdminPassword)) {
    const error = new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required for the first production administrator.');
    error.statusCode = 503;
    throw error;
  }
}
