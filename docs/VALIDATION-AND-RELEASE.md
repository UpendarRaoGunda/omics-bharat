# Validation, Benchmarking and Controlled Releases

## Principle

A workflow is not validated because it runs successfully. Validation must be tied to an intended use, configured environment, reference data, acceptance criteria and controlled release.

## Release classes

### Community release

- public catalog and discovery;
- transient file checks;
- public demo workspace;
- no confidential data;
- no regulated claims.

### Enterprise research release

- authenticated private workspace;
- approved persistence and compute;
- organization access controls;
- documented backup, monitoring and support;
- research-use workflow qualification;
- customer acceptance testing.

### Regulated release

- separate environment and release train;
- validated intended use;
- formal change control;
- approved electronic records and signatures where required;
- immutable audit export;
- qualification package;
- customer quality agreement.

## Workflow qualification package

For each executable workflow, record:

1. Intended purpose and excluded uses.
2. Pipeline source and license.
3. Version and source commit.
4. Container image digests.
5. Reference and annotation versions.
6. Parameters and defaults.
7. Supported input types and limits.
8. Test datasets and expected outputs.
9. Performance characteristics.
10. Known limitations and failure modes.
11. QC acceptance criteria.
12. Reproducibility evidence.
13. Security review.
14. Change history.
15. Scientific owner and approver.

## Benchmark types

### Technical reproducibility

- same inputs and pins produce equivalent expected outputs;
- checksum and tolerance rules are documented;
- nondeterministic tools are identified;
- environment differences are controlled.

### Analytical benchmarking

Depending on the workflow:

- sensitivity and precision;
- specificity;
- concordance;
- calibration;
- limit of detection;
- batch robustness;
- reference-standard performance;
- false-positive and false-negative analysis.

### Dataset-quality framework validation

The deterministic quality profile should be reviewed against expert assessments. Measure:

- agreement by component;
- inter-reviewer variability;
- missing-field detection;
- calibration of grade thresholds;
- failure cases;
- whether the score changes dataset-selection decisions appropriately.

Do not optimize only for correlation with an overall expert score. Component transparency and safe failure behavior are more important.

### Harmonization validation

- exact-match accuracy;
- synonym accuracy;
- identifier correctness;
- false mapping rate;
- unmapped rate;
- reviewer correction rate;
- preservation of original values;
- round-trip export tests;
- organization-specific mapping isolation.

## Evidence-package review

Every generated evidence package should support:

- source-level traceability;
- dataset-selection rationale;
- contradiction capture;
- limitation capture;
- population relevance review;
- independent validation status;
- reviewer identity;
- review date;
- immutable export checksum.

The generator must not automatically transform a collection of sources into a therapeutic or clinical recommendation.

## Change control

A controlled release process should include:

- protected branches;
- required code review;
- CI test evidence;
- security scanning;
- migration review;
- workflow-version impact assessment;
- data-model compatibility review;
- release notes;
- rollback plan;
- post-deployment verification;
- customer communication for material changes.

## Required production test layers

1. Unit tests for scientific and authorization logic.
2. API contract tests.
3. Tenant-isolation tests.
4. Property and fuzz tests for parsers.
5. Browser accessibility tests.
6. Workflow integration tests.
7. Backup and restore tests.
8. Load and rate-limit tests.
9. Security tests.
10. Disaster-recovery exercises.
11. Scientific benchmark suites.
12. Customer acceptance tests.

## Claims policy

Product marketing must distinguish:

- implemented control;
- tested control;
- independently audited control;
- certified organization or environment;
- qualified workflow;
- clinically validated intended use;
- regulator-authorized product.

No phrase should collapse these distinct levels into a generic “compliant” or “validated” claim.
