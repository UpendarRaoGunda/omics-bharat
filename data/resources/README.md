# Modular public-resource catalog

Omics Bharat combines the original `data/resources.json` file with every `.json` file in this directory.

## Coverage

The catalog is organised around practical research needs:

- Indian public infrastructure and training
- sequence archives and genome browsers
- population variation and clinical genomics
- expression, epigenomics and single-cell data
- proteins, structures and proteomics
- metabolomics, chemistry and pharmacology
- microbiome, pathogens and biodiversity
- pathways, networks and molecular interactions
- clinical trials, drug safety and disease knowledge
- literature, standards and ontologies
- open-source software, workflows, training and public compute

## Required fields

Every entry must include:

- `id`
- `name`
- `organization`
- `scope`
- `kind`
- `omics`
- `state`
- `region`
- `access`
- `url`
- `description`
- `tags`
- `verifiedOn`

Recommended fields:

- `category`
- `api`
- `apiUrl`
- `openSource`
- `license`

## Curation principles

1. Prefer official institutional or project URLs.
2. Include resources with broad public value, not every small or abandoned database.
3. Describe access honestly as `open`, `mixed`, `controlled` or `information`.
4. Do not imply endorsement, partnership, funding or data hosting.
5. Human-level data portals must clearly state controlled-access conditions.
6. Preprints and spontaneous adverse-event reports must not be presented as validated clinical conclusions.
7. Update `verifiedOn` when a source and its access model are reviewed.
8. Keep IDs globally unique; the loader fails fast on duplicates.

The API supports filtering by `query`, `kind`, `category`, `omics`, `scope`, `region`, `access`, `api` and `openSource`.
