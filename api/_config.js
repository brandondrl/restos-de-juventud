const config = {
  DATABASE_URL:     process.env.DATABASE_URL,
  JWT_SECRET:       process.env.JWT_SECRET,
  ADMIN_SECRET:     process.env.ADMIN_SECRET,
  VERCEL_ENV:       process.env.VERCEL_ENV,
  BOT_URL:          process.env.BOT_URL,
  WEBHOOK_SECRET:   process.env.WEBHOOK_SECRET,
};

module.exports = config;
