const webpush = require('web-push');
const { getSql } = require('./_db');
const { requireAuth } = require('./_auth');
const { badRequest, methodNotAllowed, forbidden } = require('./_http');

function initVapid() {
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || 'mailto:admin@restos-de-juventud.vercel.app';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subj, pub, priv);
  return true;
}

module.exports = async (req, res) => {
  const sql = getSql();

  if (req.method === 'POST' && req.headers['x-internal-secret'] === process.env.ADMIN_SECRET) {
    if (!initVapid()) return res.status(500).json({ error: 'VAPID no configurado' });
    const { subscription, title, body } = req.body;
    if (!subscription) return badRequest(res, 'subscription requerida');
    try {
      await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
      return res.json({ ok: true });
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await sql`UPDATE users SET push_subscription = NULL WHERE push_subscription = ${JSON.stringify(subscription)}`;
      }
      return res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const user = requireAuth(req, res);
    if (!user) return;
    const { subscription } = req.body;
    if (!subscription || typeof subscription !== 'object') return badRequest(res, 'subscription inválida');
    await sql`UPDATE users SET push_subscription = ${JSON.stringify(subscription)} WHERE id = ${user.id}`;
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const user = requireAuth(req, res);
    if (!user) return;
    await sql`UPDATE users SET push_subscription = NULL WHERE id = ${user.id}`;
    return res.json({ ok: true });
  }

  methodNotAllowed(res);
};
