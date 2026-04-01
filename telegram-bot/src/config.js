import 'dotenv/config';

export const config = {
  botToken: process.env.BOT_TOKEN,
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',
  schemasPath: process.env.SCHEMAS_PATH || '../../../schemas',
};
