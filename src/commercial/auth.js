import {
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';

const ROLE_PERMISSIONS = Object.freeze({
  owner: ['*'],
  admin: ['*'],
  scientist: [
    'organization.read',
    'project.read', 'project.write',
    'search.read', 'search.write',
    'quality.evaluate',
    'harmonize.run',
    'workflow.read', 'run.read', 'run.write',
    'report.read', 'report.write',
    'audit.read',
    'apikey.read', 'apikey.write'
  ],
  reviewer: [
    'organization.read',
    'project.read',
    'search.read',
    'quality.evaluate',
    'harmonize.run',
    'workflow.read', 'run.read',
    'report.read', 'report.write',
    'audit.read'
  ],
  viewer: [
    'organization.read',
    'project.read',
    'search.read',
    'workflow.read', 'run.read',
    'report.read'
  ]
});

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function decode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqualText(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hashPassword(password, salt = randomBytes(16).toString('base64url')) {
  const digest = pbkdf2Sync(String(password), salt, 210_000, 32, 'sha256').toString('base64url');
  return { salt, digest, algorithm: 'pbkdf2-sha256', iterations: 210_000 };
}

export function verifyPassword(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const candidate = hashPassword(password, user.passwordSalt).digest;
  return safeEqualText(candidate, user.passwordHash);
}

export function issueSession(user, organizations, config) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'omics-bharat',
    aud: 'omics-bharat-commercial',
    sub: user.id,
    email: user.email,
    name: user.name,
    demo: Boolean(user.demo),
    organizations: organizations.map((item) => ({ id: item.id, role: item.role })),
    iat: now,
    exp: now + config.sessionTtlSeconds
  };
  const body = encode(JSON.stringify(payload));
  return `${body}.${sign(body, config.sessionSecret)}`;
}

export function verifySession(token, config) {
  if (!token || !config.sessionSecret) return null;
  const [body, signature, extra] = String(token).split('.');
  if (!body || !signature || extra || !safeEqualText(signature, sign(body, config.sessionSecret))) return null;
  try {
    const payload = JSON.parse(decode(body));
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== 'omics-bharat' || payload.aud !== 'omics-bharat-commercial' || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function ensureBootstrapIdentity(store, config) {
  if (config.demoEnabled) return store.get('users', 'usr_demo_owner');
  if (!config.bootstrapAdminEmail || !config.bootstrapAdminPassword) return null;

  let user = await store.find('users', (item) => item.email === config.bootstrapAdminEmail);
  if (user) return user;

  const password = hashPassword(config.bootstrapAdminPassword);
  user = await store.insert('users', {
    email: config.bootstrapAdminEmail,
    name: 'Omics Bharat Administrator',
    passwordHash: password.digest,
    passwordSalt: password.salt,
    passwordAlgorithm: password.algorithm,
    active: true,
    demo: false
  }, { idPrefix: 'usr' });

  const organization = await store.insert('organizations', {
    name: 'Omics Bharat Enterprise',
    slug: 'omics-bharat-enterprise',
    plan: 'enterprise',
    dataClassification: 'organization-controlled'
  }, { idPrefix: 'org' });

  await store.insert('memberships', {
    userId: user.id,
    organizationId: organization.id,
    role: 'owner'
  }, { idPrefix: 'mem' });

  await store.audit({
    organizationId: organization.id,
    actorId: 'system',
    action: 'identity.bootstrap',
    resourceType: 'user',
    resourceId: user.id,
    detail: { email: user.email }
  });

  return user;
}

export async function loginWithPassword(store, config, email, password) {
  await ensureBootstrapIdentity(store, config);
  const normalized = String(email || '').trim().toLowerCase();
  const user = await store.find('users', (item) => item.email === normalized && item.active !== false);
  if (!user || !verifyPassword(password, user)) return null;
  const organizations = await store.organizationsForUser(user.id);
  return { user: publicUser(user), organizations, token: issueSession(user, organizations, config) };
}

export async function loginDemo(store, config) {
  if (!config.demoEnabled) return null;
  const user = await store.get('users', 'usr_demo_owner');
  const organizations = await store.organizationsForUser(user.id);
  return { user: publicUser(user), organizations, token: issueSession(user, organizations, config) };
}

export async function authenticateRequest(req, store, config) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const digest = hashApiKey(apiKey);
    const keyRecord = await store.find('apiKeys', (item) => item.hash === digest && item.revokedAt === undefined);
    if (keyRecord) {
      const user = await store.get('users', keyRecord.userId);
      if (user?.active !== false) {
        await store.update('apiKeys', keyRecord.id, { lastUsedAt: new Date().toISOString() });
        return {
          type: 'api-key',
          user: publicUser(user),
          organizationId: keyRecord.organizationId,
          role: keyRecord.role || 'scientist',
          apiKeyId: keyRecord.id
        };
      }
    }
  }

  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return null;
  const payload = verifySession(authorization.slice(7).trim(), config);
  if (!payload) return null;
  const user = await store.get('users', payload.sub);
  if (!user || user.active === false) return null;
  return { type: 'session', user: publicUser(user), session: payload };
}

export async function resolveOrganization(req, auth, store) {
  const requested = String(req.headers['x-organization-id'] || '').trim();
  const organizations = await store.organizationsForUser(auth.user.id);
  const selected = requested
    ? organizations.find((item) => item.id === requested)
    : organizations.find((item) => item.id === auth.organizationId) || organizations[0];
  if (!selected) return null;
  return selected;
}

export function hasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}

export function requirePermission(role, permission) {
  if (hasPermission(role, permission)) return;
  const error = new Error(`The ${role || 'unknown'} role does not have ${permission} permission.`);
  error.statusCode = 403;
  throw error;
}

export function createApiKeySecret() {
  return `ob_${randomBytes(26).toString('base64url')}`;
}

export function hashApiKey(secret) {
  return createHash('sha256').update(String(secret)).digest('hex');
}

export function apiKeyPrefix(secret) {
  return String(secret).slice(0, 10);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    demo: Boolean(user.demo),
    active: user.active !== false,
    createdAt: user.createdAt
  };
}

export function permissionsForRole(role) {
  return [...(ROLE_PERMISSIONS[role] || [])];
}
