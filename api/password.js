import { put, get } from '@vercel/blob';

const ADMIN_PATH = 'portfolio/admin.json';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readJson(pathname) {
  try {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch {
    return null;
  }
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const body = await getBody(req);
  const { action, password, newPassword } = body;
  const currentPassword = await getAdminPassword();

  // ─── Verificar senha (login) ───────────────────────────────────────────────
  if (action === 'verify') {
    if (password === currentPassword) {
      return res.status(200).json({ ok: true });
    }
    return res.status(401).json({ ok: false, error: 'Senha incorreta.' });
  }

  // ─── Trocar senha ──────────────────────────────────────────────────────────
  if (action === 'change') {
    if (password !== currentPassword) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }
    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 4 caracteres.' });
    }

    await put(ADMIN_PATH, JSON.stringify({ password: newPassword.trim() }), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Ação inválida.' });
}
