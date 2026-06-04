function json(res, status, message) {
  return res.status(status).json({ error: message });
}

function badRequest(res, message) {
  return json(res, 400, message || 'Solicitud inválida');
}

function unauthorized(res, message) {
  return json(res, 401, message || 'No autorizado');
}

function notFound(res, message) {
  return json(res, 404, message || 'No encontrado');
}

function conflict(res, message) {
  return json(res, 409, message || 'Conflicto');
}

function forbidden(res, message) {
  return json(res, 403, message || 'Prohibido');
}

function methodNotAllowed(res) {
  return res.status(405).end();
}

function internal(res, err, ctx) {
  const requestId = Math.random().toString(36).slice(2, 10);
  console.error(JSON.stringify({
    level: 'error',
    requestId,
    message: err?.message || 'Error interno',
    context: ctx,
    stack: err?.stack,
    timestamp: new Date().toISOString(),
  }));
  return res.status(500).json({ error: 'Error interno', requestId });
}

function log(level, message, context) {
  const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[method](JSON.stringify({
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  }));
}

module.exports = { badRequest, unauthorized, notFound, conflict, forbidden, methodNotAllowed, internal, log };
