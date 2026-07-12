-- Omics Bharat commercial reference schema (PostgreSQL 15+)
-- This schema is a deployment template. Applying it does not create a validated,
-- certified, or clinically suitable environment.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  identity_provider text,
  identity_subject text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (identity_provider, identity_subject)
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null check (plan in ('community','research-team','enterprise','regulated')),
  data_classification text not null default 'organization-controlled',
  deployment_region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('owner','admin','scientist','reviewer','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active',
  intended_use text not null default 'research-use-only',
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists saved_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  query text not null,
  source text not null,
  filters jsonb not null default '{}'::jsonb,
  alert_cadence text not null default 'manual',
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dataset_quality_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  catalog_resource_id text,
  dataset_label text not null,
  framework_version text not null,
  result jsonb not null,
  result_checksum text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  workflow_id text not null,
  status text not null,
  manifest jsonb not null,
  manifest_checksum text not null,
  external_run_id text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists evidence_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  status text not null,
  package jsonb not null,
  package_checksum text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  prefix text not null,
  secret_hash text not null unique,
  role text not null check (role in ('scientist','reviewer','viewer')),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  sequence_id bigint generated always as identity primary key,
  id uuid not null default gen_random_uuid() unique,
  organization_id uuid not null references organizations(id) on delete restrict,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  request_id text,
  detail jsonb not null default '{}'::jsonb,
  previous_event_hash text,
  event_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_org on projects(organization_id);
create index if not exists idx_searches_org_project on saved_searches(organization_id, project_id);
create index if not exists idx_quality_org_project on dataset_quality_profiles(organization_id, project_id);
create index if not exists idx_runs_org_project on workflow_runs(organization_id, project_id);
create index if not exists idx_reports_org_project on evidence_reports(organization_id, project_id);
create index if not exists idx_audit_org_created on audit_events(organization_id, created_at desc);

-- Recommended production controls:
-- 1. Enable row-level security on every organization-scoped table.
-- 2. Set the organization claim through a trusted database connection context.
-- 3. Deny direct application UPDATE/DELETE permissions on audit_events.
-- 4. Stream audit events to immutable, separately administered storage.
-- 5. Encrypt backups and exercise restoration procedures.
-- 6. Keep raw genomic objects in approved object storage, not in relational JSON columns.
-- 7. Use separate schemas or databases for regulated and non-regulated environments.
