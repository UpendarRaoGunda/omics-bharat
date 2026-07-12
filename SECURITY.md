# Security and data-handling policy

Omics Bharat is a public discovery and educational service. It is **not** designed to receive identifiable human genomic or clinical data.

## What the application stores

The default application stores no user accounts, uploaded files, sequence inputs, VCF inputs, table inputs or metadata-check inputs. Analysis requests are parsed in process memory and discarded after the response.

Standard deployment platforms may retain network, access or error logs. Operators should configure those systems appropriately and avoid logging request bodies.

## Safe use

- Never paste names, phone numbers, addresses, hospital identifiers, clinical notes or participant keys.
- Prefer synthetic or de-identified examples for the browser tools.
- Do not expose this service as a secure genomic repository without a separate security, privacy, legal and ethics architecture.
- Use institutional infrastructure and validated software for research or clinical pipelines.

## Reporting a vulnerability

Please open a private GitHub security advisory for the repository rather than posting exploitable details in a public issue.
