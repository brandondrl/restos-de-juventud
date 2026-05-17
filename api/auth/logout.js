// logout.js
const { clearCookie } = require('../_auth');
module.exports = (req, res) => { clearCookie(res); res.json({ ok: true }); };
