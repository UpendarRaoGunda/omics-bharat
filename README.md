# Omics Bharat

**A free, evidence-linked multi-omics discovery and learning platform for India.**

Omics Bharat helps students, researchers, clinicians and small laboratories:

- discover India-focused and global public omics resources;
- search NCBI GEO, NCBI SRA, NCBI ClinVar and Europe PMC from one interface;
- run lightweight FASTA, VCF, CSV/TSV and metadata checks;
- learn responsible data-sharing practices without pretending to provide clinical interpretation;
- use the platform on low-cost infrastructure with no commercial API key or JavaScript build pipeline.

> Omics Bharat is a community open-source project. It is not a government portal, hospital network, clinical service, ethics committee or secure genomic repository.

## Why this rebuild was necessary

The earlier repository was a single static HTML mock-up. Its hospital records and platform counters were hard-coded, buttons mostly displayed alerts, "live" sample counts were randomly incremented, and some funding, certification and compliance statements were not supported.

Version 2 replaces that behaviour with:

- a real HTTP backend;
- honest counts computed from the curated catalog;
- live public-source searches;
- working analysis endpoints;
- explicit source links and access labels;
- privacy and clinical-safety boundaries;
- tests, CI, Docker, Render and Vercel deployment files.

## Main features

### 1. Curated public-resource catalog

The catalog includes India-focused starting points such as the Indian Biological Data Centre, GenomeIndia, IndiGenomes, NIBMG, CSIR-IGIB and Indian ethics/data-protection resources, together with global archives and databases useful to Indian researchers.

Every entry contains:

- original source URL;
- organisation;
- resource type;
- India/global scope;
- omics areas;
- access category;
- a short original description;
- catalog review date.

Inclusion does **not** imply partnership, endorsement, funding or data hosting.

### 2. Live public evidence search

The backend connects directly to public APIs:

- **Europe PMC REST API** for biomedical publications;
- **NCBI E-utilities** for GEO, SRA and ClinVar discovery.

The India relevance switch adds an India term/affiliation filter. Users can disable it for broader searches. Results link back to the original source.

### 3. Free file-check laboratory

Inputs are processed in memory and are not written to a database by the default application.

| Tool | What it checks |
|---|---|
| FASTA summary | sequence count, molecule type, lengths, N50, GC percentage, ambiguity and invalid characters |
| VCF structural QC | VCF version, records, samples, filters, SNV/indel classes, Ti/Tv and genotype call rate |
| CSV/TSV profile | delimiter, dimensions, missingness, duplicate headers, inconsistent rows and inferred column types |
| Metadata check | core study fields, human-data governance prompts, geography/identifier risks and reproducibility fields |

These are lightweight preflight checks—not replacements for `bcftools`, `samtools`, FastQC, MultiQC, validated clinical pipelines or expert review.

### 4. Accessibility and low-bandwidth design

- no external fonts, images, analytics or UI libraries;
- responsive interface;
- keyboard-visible focus states;
- reduced-motion support;
- installable progressive web app shell;
- compact mode;
- key interface messaging in English, Hindi and Telugu;
- zero runtime npm dependencies.

## Architecture

```text
Browser
  ├─ Static HTML/CSS/JS/PWA
  ├─ Curated catalog search
  ├─ Live NCBI/Europe PMC search
  └─ File-check workbench
          │
          ▼
Node.js HTTP service (zero dependencies)
  ├─ security headers + request IDs
  ├─ in-memory rate limiting
  ├─ 5 MB request limit
  ├─ catalog API
  ├─ NCBI E-utilities connector
  ├─ Europe PMC connector
  └─ transient parsers (FASTA/VCF/CSV/metadata)
```

## Requirements

- Node.js 20 or newer
- Internet access only for live NCBI/Europe PMC searches

The catalog and file-check tools work without external API keys.

## Run locally

```bash
git clone https://github.com/UpendarRaoGunda/omics-bharat.git
cd omics-bharat
npm start
```

Open `http://localhost:3000`.

Development mode with automatic restart:

```bash
npm run dev
```

## Tests

```bash
npm run check
npm test
```

Tests use Node's built-in test runner and do not require downloading a test framework.

## API

Interactive human-readable JSON documentation is available at:

```text
GET /api/docs
```

Core routes:

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | service health and uptime |
| GET | `/api/stats` | transparent platform counts |
| GET | `/api/catalog` | filter the curated catalog |
| GET | `/api/catalog/:id` | retrieve one catalog entry |
| GET | `/api/facets` | retrieve catalog filter values |
| GET | `/api/live/status` | check public-source availability |
| GET | `/api/live/publications?q=...&india=true` | search Europe PMC |
| GET | `/api/live/studies?source=geo&q=...&india=true` | search GEO, SRA or ClinVar |
| POST | `/api/tools/fasta-summary` | plain-text FASTA summary |
| POST | `/api/tools/vcf-summary` | plain-text VCF structural QC |
| POST | `/api/tools/table-profile` | plain-text CSV/TSV profile |
| POST | `/api/tools/metadata-check` | JSON metadata checklist |

Example:

```bash
curl -X POST http://localhost:3000/api/tools/fasta-summary \
  -H 'Content-Type: text/plain' \
  --data-binary $'>demo\nACGTGCNN'
```

## Environment variables

Copy `.env.example` values into your deployment environment. The application does not automatically load `.env`; use your process manager or hosting platform.

| Variable | Required | Purpose |
|---|---:|---|
| `PORT` | No | local HTTP port, default `3000` |
| `HOST` | No | bind address, default `0.0.0.0` |
| `NCBI_TOOL` | No | identifies this client to NCBI |
| `NCBI_EMAIL` | Recommended for public deployments | contact email appended to NCBI E-utilities calls |
| `OUTBOUND_USER_AGENT` | No | user agent for public API requests |

For sustained NCBI traffic, follow NCBI rate-limit and API-key guidance rather than increasing this application's limits blindly.

## Deploy

### Render

A `render.yaml` Blueprint is included.

1. Create a new Blueprint from this repository.
2. Add `NCBI_EMAIL` as an environment variable.
3. Deploy.

The health check is `/api/health`.

### Docker

```bash
docker build -t omics-bharat .
docker run --rm -p 3000:3000 -e NCBI_EMAIL=team@example.org omics-bharat
```

### Vercel

`vercel.json` routes requests through the Node function in `api/index.js`, which also serves the static application. Add `NCBI_EMAIL` in project settings.

For higher traffic, prefer a long-running Node service because serverless instances do not share the in-memory cache or rate-limit state.

## Data handling and safety

The default code:

- does not implement accounts;
- does not save tool inputs;
- does not log request bodies;
- limits input to 5 MB;
- blocks framing and uses a restrictive content-security policy;
- allows outbound connections only to the known live-source services from the frontend;
- links externally using `noopener noreferrer`.

Deployment providers may retain access/error logs. Operators remain responsible for configuring those systems.

Do **not** submit:

- names, phone numbers, addresses or participant keys;
- clinical notes or hospital record identifiers;
- restricted raw human genomic data;
- secrets, credentials or unpublished confidential material.

Human omics work requires context-specific ethics, consent, privacy, security, legal and data-access review. The metadata checker does not certify compliance.

## Important scientific limits

- "Indian" is not one homogeneous genetic population.
- A state, language, caste, tribe, recruitment centre or broad ancestry label must not be treated as representative of India.
- Population-frequency databases are references, not diagnostic truth.
- ClinVar assertions require review of evidence, review status, phenotype match, inheritance and current expert guidance.
- Statistical associations do not establish causality or clinical utility.
- File structure checks do not establish sample identity, sequencing quality, analytical validity or clinical validity.

## Curated-source maintenance

Catalog entries are stored in `data/resources.json`.

When adding or changing an entry:

1. use an original institutional/project URL where possible;
2. confirm HTTPS availability;
3. describe access accurately;
4. avoid unsupported claims;
5. update `verifiedOn`;
6. run tests.

## Useful source documentation

- Indian Biological Data Centre: https://ibdc.dbt.gov.in/
- GenomeIndia: https://genomeindia.in/
- IndiGenomes: https://clingen.igib.res.in/indigen/
- NCBI E-utilities: https://www.ncbi.nlm.nih.gov/books/NBK25501/
- Europe PMC REST API: https://europepmc.org/RestfulWebService
- ICMR ethics resources: https://ethics.ncdirindia.org/
- GA4GH: https://www.ga4gh.org/
- FAIRsharing: https://fairsharing.org/

## Roadmap

High-value future additions should preserve the free, transparent and privacy-conscious design:

- more Indian-language educational content;
- automated source-link health checks in CI;
- BioSample/MIxS/ISA metadata templates;
- public accession watchlists without copying restricted data;
- reproducible notebook templates that run on users' own infrastructure;
- institution-submitted catalog corrections reviewed through GitHub;
- optional federated search adapters where a source provides a stable public API;
- accessibility testing and community translation review.

Not planned for the default public service:

- storing identifiable human genomes;
- direct-to-consumer genetic interpretation;
- clinical diagnosis or treatment recommendations;
- fabricated sample counts or partnerships;
- ancestry ranking or population essentialism;
- scraping sources that prohibit automated access.

## License

MIT. See `LICENSE`.
