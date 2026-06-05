const config = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_SECRET: process.env.ADMIN_SECRET,
  VERCEL_ENV: process.env.VERCEL_ENV,
};

module.exports = config;
