# Omics Bharat

**India-first omics evidence infrastructure: a free community portal plus a commercial-ready, governed research workspace.**

Omics Bharat 3.0 has two connected product surfaces:

1. **Community Edition** — free public-resource discovery, live NCBI/Europe PMC search and lightweight transient file checks.
2. **Enterprise Preview** — organizations, projects, saved evidence searches, transparent dataset-quality profiles, metadata harmonization, reproducible workflow manifests, decision-ready evidence packages, API keys and audit events.

> The product is research-use only. This repository does not claim diagnosis, treatment recommendation, regulatory approval, GxP validation, ISO certification, SOC 2 attestation or clinical suitability.

## Live interfaces

- Community portal: `/`
- Enterprise workspace: `/enterprise`
- Public API documentation: `/api/docs`
- Commercial OpenAPI document: `/api/v1/openapi`

## Why the product is structured this way

A list of omics databases is useful but not commercially defensible by itself. The commercial product focuses on the work customers pay to remove:

```text
research question
  -> evidence discovery
  -> dataset qualification
  -> metadata harmonization
  -> pinned workflow manifest
  -> approved execution adapter
  -> review-ready evidence package
  -> audit export
```

The free portal remains an acquisition and public-good layer. Commercial value comes from private collaboration, governance, reproducibility, deployment, integration and decision-ready outputs.

## Community Edition

### Curated public-resource catalog

The modular catalog covers more than one hundred Indian and global resources across:

- sequence archives and genome browsers;
- population and clinical variation;
- transcriptomics, epigenomics, single-cell and spatial data;
- proteins, structures and proteomics;
- metabolomics, chemistry and pharmacology;
- microbiome, pathogens and biodiversity;
- pathways and molecular interactions;
- clinical trials, safety and rare-disease evidence;
- literature, standards and ontologies;
- open-source workflows, tools, training and public compute.

Catalog entries preserve original source URLs, access labels, scope, categories, omics areas, review dates and capability flags. Inclusion never implies partnership, endorsement or data hosting.

### Live evidence search

- Europe PMC publications;
- NCBI GEO;
- NCBI SRA;
- NCBI ClinVar.

Results link to original public records.

### Transient file checks

| Tool | Purpose |
|---|---|
| FASTA summary | sequence structure, length, GC, ambiguity and invalid characters |
| VCF summary | structure, samples, filters, variant classes, Ti/Tv and call rate |
| CSV/TSV profile | dimensions, missingness, duplicate headers and inferred types |
| Metadata check | completeness, governance prompts and privacy risks |

These are preflight checks, not substitutes for validated analytical pipelines.

## Enterprise Preview

### Identity and tenant controls

- signed sessions;
- organization membership;
- roles: owner, admin, scientist, reviewer and viewer;
- backend permission checks;
- scoped API keys stored only as hashes;
- organization-scoped projects and records.

The built-in bootstrap password flow is for controlled evaluation only. Production deployments should use managed OIDC/SAML, MFA and SCIM.

### Dataset Quality Profile

The transparent framework scores six visible components:

| Component | Weight |
|---|---:|
| Metadata completeness | 25% |
| Provenance and versioning | 20% |
| Cohort and study suitability | 15% |
| Assay and analytical quality | 15% |
| Reproducibility | 15% |
| Governance and reuse readiness | 10% |

The score exposes missing evidence, warnings, priority actions and formula weights. It is not a black-box AI score and does not establish clinical validity.

### Harmonization

The harmonization API preserves original values while returning:

- canonical label;
- identifier where a reviewed mapping exists;
- mapping source;
- confidence;
- review requirement;
- engine version and timestamp.

Organization-specific mapping tables can be supplied without overwriting the source value.

### Reproducible workflow manifests

The workflow registry includes evidence review and common nf-core workflow families. Run manifests capture:

- workflow ID, version and commit;
- container digests;
- reference and annotation versions;
- parameters and inputs;
- organization, project and operator;
- data classification;
- missing pin requirements;
- deterministic checksum.

The default `manifest` executor does not run compute. A signed administrator-controlled webhook can connect an approved Nextflow, Galaxy, HPC, Kubernetes or cloud execution service.

### Decision-ready evidence packages

Reports contain:

- research question and scope;
- selected catalog sources;
- quality profiles where available;
- supporting findings;
- contradictory evidence;
- gaps and limitations;
- population-relevance and validation status;
- provenance and checksum;
- JSON and Markdown output.

The generator organizes evidence but does not invent a biological or clinical conclusion.

### Auditability

Workspace mutations create organization-scoped audit events. Production deployments should stream these events to separately administered immutable storage.

## API overview

### Public endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | service health |
| GET | `/api/stats` | transparent capability counts |
| GET | `/api/catalog` | filtered catalog |
| GET | `/api/facets` | catalog filter values |
| GET | `/api/live/publications` | Europe PMC search |
| GET | `/api/live/studies` | NCBI search |
| POST | `/api/tools/*` | transient community checks |

### Commercial endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v1/status` | deployment mode and boundaries |
| POST | `/api/v1/auth/demo` | safe ephemeral demo session |
| POST | `/api/v1/auth/login` | signed production-evaluation session |
| GET/POST | `/api/v1/organizations` | organizations |
| GET/POST | `/api/v1/projects` | research projects |
| GET/POST | `/api/v1/saved-searches` | evidence watchlists |
| POST | `/api/v1/quality/evaluate` | dataset-quality profile |
| POST | `/api/v1/harmonize` | reversible metadata normalization |
| GET/POST | `/api/v1/runs` | workflow manifests |
| GET/POST | `/api/v1/reports` | evidence packages |
| GET | `/api/v1/audit` | audit export |
| GET/POST | `/api/v1/api-keys` | service-account keys |

Protected endpoints accept either:

```text
Authorization: Bearer <session-token>
```

or:

```text
X-API-Key: <one-time-api-key-secret>
X-Organization-Id: <organization-id>
```

## Run locally

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/UpendarRaoGunda/omics-bharat.git
cd omics-bharat
npm start
```

Open:

```text
http://localhost:3000
http://localhost:3000/enterprise
```

No npm runtime dependencies are required.

## Configuration

Copy values from `.env.example` into your deployment environment.

Important commercial variables:

| Variable | Purpose |
|---|---|
| `COMMERCIAL_MODE` | `demo`, `production` or `off` |
| `OMICS_SESSION_SECRET` | HMAC session secret; required outside demo |
| `BOOTSTRAP_ADMIN_EMAIL` | first evaluation administrator |
| `BOOTSTRAP_ADMIN_PASSWORD` | first evaluation administrator password |
| `OMICS_DATA_DIR` | optional single-node file persistence |
| `WORKFLOW_EXECUTOR` | `manifest` or `webhook` |
| `WORKFLOW_WEBHOOK_URL` | approved execution service |
| `WORKFLOW_WEBHOOK_SECRET` | webhook signature secret |
| `ALLOW_PRIVATE_HUMAN_DATA` | disabled by default |
| `DEPLOYMENT_REGION` | deployment metadata |

The file adapter is for evaluation. Use the reference PostgreSQL schema and an approved object-storage architecture for production.

## Testing

```bash
npm run check
npm test
```

Tests cover:

- catalog and community APIs;
- transient parsers;
- dataset-quality components;
- harmonization provenance;
- workflow pinning and checksums;
- evidence-package boundaries;
- commercial authentication and RBAC;
- projects, searches, API keys and audit events;
- private-human-data rejection;
- enterprise page and OpenAPI delivery.

## Deployment guidance

### Public demo

The default mode is an ephemeral demo suitable only for non-sensitive examples. Serverless instances may reset at any time.

### Evaluation deployment

Use:

- a long random session secret;
- bootstrap credentials stored in a secrets manager;
- an encrypted host volume through `OMICS_DATA_DIR`;
- TLS;
- restricted network access;
- centralized monitoring;
- documented backups.

### Production target

Before selling enterprise handling of private data, replace evaluation components with:

- managed OIDC/SAML and MFA;
- managed PostgreSQL with tenant isolation;
- approved object storage;
- secrets management and key rotation;
- immutable audit export;
- backups and restoration exercises;
- private networking;
- vulnerability management and penetration testing;
- incident response and support operations;
- customer-specific security and validation evidence.

## Documentation

- [`docs/COMMERCIAL-ARCHITECTURE.md`](docs/COMMERCIAL-ARCHITECTURE.md)
- [`docs/SECURITY-COMPLIANCE-BOUNDARIES.md`](docs/SECURITY-COMPLIANCE-BOUNDARIES.md)
- [`docs/DESIGN-PARTNER-PILOT.md`](docs/DESIGN-PARTNER-PILOT.md)
- [`docs/VALIDATION-AND-RELEASE.md`](docs/VALIDATION-AND-RELEASE.md)
- [`db/commercial-schema.sql`](db/commercial-schema.sql)

## Data and scientific boundaries

Do not submit names, contact information, participant keys, clinical notes, restricted human genomes, credentials, unpublished confidential material or data whose terms do not allow the intended use.

“Indian” is not one homogeneous genetic population. State, language, caste, tribe, recruitment center, geography and ancestry are distinct concepts. Population reference data, associations and variant assertions require context and expert review.

## License

MIT for the repository source. External databases, workflows, ontologies and datasets retain their own licenses and terms. A commercial Omics Bharat contract must not imply ownership of third-party resources.
