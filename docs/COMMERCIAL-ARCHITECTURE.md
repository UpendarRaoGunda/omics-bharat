# Omics Bharat Commercial Architecture

## Product boundary

Omics Bharat 3.0 keeps the public community portal and adds a commercial research-workspace foundation. The release is **research-use only**. It does not claim diagnostic suitability, clinical validation, regulatory approval, ISO certification, SOC 2 attestation, GxP validation, or compliance merely because controls exist in source code.

## Commercial value chain

```text
Research question
  -> evidence discovery
  -> dataset qualification
  -> metadata harmonization
  -> reproducible workflow manifest
  -> governed execution adapter
  -> decision-ready evidence package
  -> review + audit export
```

The product is designed to monetize governance, harmonization, reproducibility, private collaboration, deployment and decision-ready outputs while preserving a free public discovery layer.

## Implemented modules

### Multi-tenant workspace

- organizations;
- memberships and roles;
- research projects;
- organization-scoped saved searches;
- API keys stored as hashes;
- signed sessions;
- organization-scoped audit events.

Roles are `owner`, `admin`, `scientist`, `reviewer` and `viewer`. Authorization is enforced server-side rather than only in the browser.

### Dataset Quality Profile

The quality framework exposes six weighted components:

| Component | Weight |
|---|---:|
| Metadata completeness | 25% |
| Provenance and versioning | 20% |
| Cohort and study suitability | 15% |
| Assay and analytical quality | 15% |
| Reproducibility | 15% |
| Governance and reuse readiness | 10% |

Every component returns its evidence, missing fields, score and weighted contribution. The result is deterministic and explicitly states that it is not an AI confidence score or proof of clinical validity.

### Harmonization engine

The engine preserves:

- the original source value;
- the normalized value;
- an identifier when a reviewed mapping exists;
- confidence;
- mapping source;
- review requirement;
- transformation timestamp and engine version.

Organization-specific mapping dictionaries can be supplied. Automatic mappings remain subject to scientific review.

### Workflow manifests

The workflow registry includes research-use templates for evidence review and common nf-core workflow families. Omics Bharat does not silently select an unpinned pipeline. Execution manifests record:

- workflow identifier;
- workflow version and commit;
- container digests;
- reference bundle;
- annotation version;
- inputs and parameters;
- data classification;
- deployment region;
- operator and organization;
- checksum;
- missing pinning requirements.

The default executor is `manifest`, which creates a reviewable manifest without running compute. `WORKFLOW_EXECUTOR=webhook` enables a signed integration boundary to an administrator-controlled workflow service.

### Evidence packages

A report records:

- research question and scope;
- selected catalog sources;
- dataset quality results where available;
- user-supplied findings;
- contradictory or uncertain evidence;
- evidence gaps;
- limitations;
- decision-readiness fields;
- provenance and checksum;
- Markdown and JSON representations.

The generator is deterministic and does not invent a scientific conclusion.

## Storage adapters

### Public demo

The default Vercel-friendly demo uses an in-memory adapter. It is intentionally ephemeral and must not be used for confidential data.

### Single-node evaluation

Set `OMICS_DATA_DIR` to use an atomic JSON-file adapter on an encrypted, access-controlled host volume. This is useful for evaluation and pilots, but it is not the recommended final enterprise database.

### Production target

`db/commercial-schema.sql` provides a PostgreSQL reference model. A production adapter should add:

- managed PostgreSQL;
- row-level security or equivalent tenant controls;
- encrypted object storage for large files;
- backup and restoration testing;
- database migrations;
- connection pooling;
- immutable audit export;
- secrets-manager integration;
- explicit retention and deletion workflows.

## Identity target

The built-in password bootstrap exists only to create the first administrator in a controlled evaluation deployment. Enterprise deployments should replace it with managed OIDC or SAML, MFA and SCIM. The application authorization layer should continue to enforce organization and role permissions after identity-provider authentication.

## Compute target

Use established engines rather than reimplementing bioinformatics algorithms:

- Nextflow and nf-core;
- Galaxy where appropriate;
- container registries with immutable digests;
- Kubernetes, cloud batch or approved HPC schedulers;
- customer-controlled object storage;
- OpenTelemetry-compatible monitoring;
- cost and quota controls.

The webhook contract is intentionally vendor-neutral so a Seqera, Galaxy, Kubernetes, HPC or custom execution service can be connected later.

## GA4GH-aligned evolution

Future interoperability adapters should prioritize:

- Tool Registry Service;
- Workflow Execution Service;
- Task Execution Service;
- Data Repository Service;
- Beacon;
- Data Use Ontology;
- Passports and access-policy claims.

Implement these as versioned adapters rather than embedding assumptions throughout the product.

## Recommended service decomposition

```text
Community web + catalog API
Commercial web application
Identity and tenant service
Evidence/catalog service
Harmonization service
Workflow orchestration service
Report and provenance service
Notification worker
Audit export worker
Managed PostgreSQL
Approved object storage
Secrets manager
Observability stack
```

The current single-process Node implementation intentionally keeps module boundaries clear so these services can be separated when traffic, security review or team ownership requires it.
