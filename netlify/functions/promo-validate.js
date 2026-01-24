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
  // Si vous voyez cette erreur, c'est que les dépendances NPM n'ont pas été installées.
  // Sur Netlify, cela arrive le plus souvent avec un déploiement "Manual deploy" (drag & drop).
  // Solution : connecter le site à Git (ou Netlify CLI avec build) pour que Netlify exécute npm install.
  if (!getStore) {
    return json(500, {
      valid: false,
      error: 'blobs_dependency_missing',
      message:
        "Le module '@netlify/blobs' n'est pas disponible dans ce déploiement. " +
        "Connectez le site à Git (Continuous deployment) ou déployez via Netlify CLI avec build pour installer les dépendances.",
    });
  }

  try {
    const code = normalize(event.queryStringParameters?.code);
    if (!code) return json(200, { valid: false });

    const store = getStore({ name: 'promo-codes', consistency: 'strong' });
    const entry = await store.get(code, { type: 'json' });

    if (!entry || entry.active === false) return json(200, { valid: false });

    const percent = Number(entry.percent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 90) {
      return json(200, { valid: false });
    }

    return json(200, { valid: true, code, percent });
  } catch (e) {
    return json(200, { valid: false });
  }
};
