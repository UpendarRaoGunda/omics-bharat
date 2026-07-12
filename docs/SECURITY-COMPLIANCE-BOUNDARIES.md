# Security, Privacy and Compliance Boundaries

## Honest status

This repository implements security-oriented product controls, but organizational compliance requires people, policies, contracts, evidence, independent audits and continuous operations. The software must never display an ISO, SOC 2, HIPAA, GxP, 21 CFR Part 11 or clinical-compliance badge unless the applicable environment and organization have actually completed that work.

## Current code controls

- restrictive HTTP security headers;
- request identifiers;
- rate limiting;
- signed sessions with expiration;
- password hashing for the bootstrap identity;
- API key hashing and one-time secret display;
- role-based permissions checked in the backend;
- organization scoping;
- human-data rejection unless explicitly enabled;
- checksummed run manifests and reports;
- organization audit events;
- no request-body logging in normal application code;
- no permanent retention in community analysis endpoints;
- explicit research-use and clinical-use boundaries.

## Demo limitations

The public demo:

- stores workspace state in process memory;
- can reset at any time;
- is not a secure data room;
- does not provide contractual confidentiality;
- must not receive identifiable, restricted, unpublished or confidential data;
- must not be used to execute clinical or regulated workflows.

## Required production controls

### Identity and access

- managed OIDC/SAML identity provider;
- mandatory MFA;
- SCIM lifecycle management;
- periodic access review;
- separation of administrator and scientific roles;
- break-glass procedure;
- service-account rotation;
- short-lived tokens;
- session revocation.

### Data protection

- documented data classification;
- encryption in transit and at rest;
- customer-managed key option where required;
- approved Indian and international deployment regions;
- private networking;
- encrypted backups;
- restoration tests;
- object-level retention and deletion;
- secure deletion evidence;
- data-processing and subprocessor agreements.

### Application security

- threat model maintained with each material architecture change;
- dependency and container scanning;
- software bill of materials;
- secret scanning;
- static and dynamic security testing;
- independent penetration testing;
- abuse-case testing;
- signed releases;
- protected branches and mandatory review;
- vulnerability disclosure and remediation SLAs.

### Operations

- centralized logs without sensitive payloads;
- security monitoring and alerting;
- incident classification and response;
- breach-notification process;
- disaster-recovery objectives;
- business-continuity exercises;
- uptime and support objectives;
- customer-facing status page;
- change and release management;
- vendor-risk review.

## Human genomic data

Private human genomic data is disabled by default. Enabling `ALLOW_PRIVATE_HUMAN_DATA=true` is not sufficient authorization. Before enabling it, an operator must establish:

- lawful and ethical basis;
- participant consent and data-use conditions;
- ethics and institutional approvals;
- data-controller and processor responsibilities;
- retention and withdrawal handling;
- approved storage and compute boundary;
- access-review process;
- incident-response requirements;
- cross-border transfer review;
- re-identification risk controls;
- contractual restrictions on downstream use.

## Regulated workflows

A regulated edition requires a precisely defined intended use. Validation should cover the complete configured system, not only source code. Evidence may include:

- user requirements;
- functional and design specifications;
- risk assessment;
- traceability matrix;
- installation qualification;
- operational qualification;
- performance qualification where applicable;
- test evidence;
- deviation handling;
- electronic-record and signature controls;
- audit-trail review;
- backup and restore qualification;
- training records;
- SOPs;
- change-control records;
- periodic review.

## Clinical boundary

The platform currently supports research evidence organization. It does not:

- diagnose disease;
- select treatment;
- determine clinical pathogenicity;
- replace molecular tumor boards;
- certify analytical validity;
- certify clinical validity;
- certify clinical utility;
- create regulatory approval.

Any future clinical module should be separated technically, contractually and in product labeling from the research-use platform until the appropriate validation and authorization are complete.
