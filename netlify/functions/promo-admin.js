let getStore;
try {
  ({ getStore } = require('@netlify/blobs'));
} catch (e) {
  getStore = null;
}

function normalize(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (!getStore) {
    return json(500, {
      error: 'blobs_dependency_missing',
      message:
        "Le module '@netlify/blobs' n'est pas disponible dans ce déploiement. " +
        "Connectez le site à Git (Continuous deployment) ou déployez via Netlify CLI avec build pour installer les dépendances.",
    });
  }

  const admin = (event.headers?.['x-admin-key'] || '').trim();
  const expected = (process.env.ADMIN_CODE || '').trim();

  if (!expected) return json(500, { error: 'ADMIN_CODE missing' });
  if (admin !== expected) return json(401, { error: 'unauthorized' });

  const store = getStore({ name: 'promo-codes', consistency: 'strong' });

  if (event.httpMethod === 'GET') {
    const { blobs } = await store.list();
    const codes = [];
    for (const b of blobs) {
      const data = await store.get(b.key, { type: 'json' });
      if (data) codes.push({ code: b.key, ...data });
    }
    codes.sort((a, b) => (a.code > b.code ? 1 : -1));
    return json(200, { codes });
  }

  if (event.httpMethod === 'POST') {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch (_) {}

    const action = body.action;
    const code = normalize(body.code);

    if (!code) return json(400, { error: 'code required' });

    if (action === 'delete') {
      await store.delete(code);
      return json(200, { ok: true });
    }

    const percent = Number(body.percent);
    const active = body.active !== false;

    if (!Number.isFinite(percent) || percent <= 0 || percent > 90) {
      return json(400, { error: 'percent 1..90' });
    }

    await store.setJSON(code, {
      percent,
      active,
      updatedAt: new Date().toISOString(),
    });

    return json(200, { ok: true });
  }

  return json(405, { error: 'method not allowed' });
};
