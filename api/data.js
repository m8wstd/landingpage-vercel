import { put, list } from '@vercel/blob';

const DATA_PATH = 'portfolio/data.json';
const ADMIN_PATH = 'portfolio/admin.json';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readJson(pathname) {
  const { blobs } = await list({ prefix: pathname });
  const blob = blobs.find((b) => b.pathname === pathname);
  if (!blob) return null;
  const res = await fetch(blob.downloadUrl);
  if (!res.ok) return null;
  return res.json();
}

async function getAdminPassword() {
  const adminData = await readJson(ADMIN_PATH).catch(() => null);
  return adminData?.password || process.env.ADMIN_PASSWORD;
}

async function getBody(req) {
  if (req.body !== undefined) return req.body;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ─── GET: lê projetos + siteConfig do Blob ─────────────────────────────────
  if (req.method === 'GET') {
    try {
      const data = await readJson(DATA_PATH);
      return res.status(200).json(data || {});
    } catch (err) {
      console.error('[api/data] GET error:', err);
      return res.status(500).json({ error: 'Falha ao ler dados.' });
    }
  }

  // ─── POST: salva projetos e/ou siteConfig no Blob ──────────────────────────
  if (req.method === 'POST') {
    const password = req.headers['x-admin-password'];
    const correctPassword = await getAdminPassword();

    if (!password || password !== correctPassword) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    try {
      const body = await getBody(req);
      const existing = (await readJson(DATA_PATH).catch(() => null)) || {};

      const newData = {
        projects: body.projects !== undefined ? body.projects : existing.projects,
        siteConfig: body.siteConfig !== undefined ? body.siteConfig : existing.siteConfig,
      };

      await put(DATA_PATH, JSON.stringify(newData), {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json',
      });

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[api/data] POST error:', err);
      return res.status(500).json({ error: 'Falha ao salvar dados.' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' });
}
