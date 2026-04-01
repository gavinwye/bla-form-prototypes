import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { config } from './config.js';
import { loadAllSchemas } from './schema/loader.js';
import { createFormConversation } from './bot/conversation.js';
import { buildFormListKeyboard } from './messages/keyboards.js';

if (!config.botToken) {
  console.error('BOT_TOKEN is not set. Copy .env.example to .env and add your token from @BotFather.');
  process.exit(1);
}

// Load all form schemas
const schemas = loadAllSchemas();
console.log(`Loaded ${schemas.size} form schemas`);

// Create bot
const bot = new Bot(config.botToken);

// Install session and conversations middleware
bot.use(session({
  initial: () => ({ selectedFormId: null }),
}));
bot.use(conversations());

// Register the form-filling conversation
const formConversation = createFormConversation(schemas);
bot.use(createConversation(formConversation, 'form-filling'));

// /start command
bot.command('start', async (ctx) => {
  await ctx.reply(
    `<b>Welcome to the Barbados Licensing Authority</b>\n\n` +
    `I can help you complete and submit BLA forms right here in Telegram.\n\n` +
    `Send /forms to see available forms.\n` +
    `Send /help for more information.\n` +
    `Send /cancel at any time to stop filling a form.`,
    { parse_mode: 'HTML' }
  );
});

// /forms command — show list of available forms
bot.command('forms', async (ctx) => {
  const keyboard = buildFormListKeyboard(schemas);
  await ctx.reply(
    '<b>Available forms</b>\n\nTap a form to begin:',
    { parse_mode: 'HTML', reply_markup: keyboard }
  );
});

// /help command
bot.command('help', async (ctx) => {
  await ctx.reply(
    `<b>How to use this bot</b>\n\n` +
    `1. Send /forms to see available forms\n` +
    `2. Tap a form to start filling it in\n` +
    `3. Answer each question one at a time\n` +
    `4. Review your answers at the end\n` +
    `5. Submit when you're happy\n\n` +
    `<b>Commands</b>\n` +
    `/forms — See available forms\n` +
    `/cancel — Stop the current form\n` +
    `/skip — Skip an optional question\n` +
    `/help — Show this message`,
    { parse_mode: 'HTML' }
  );
});

// /cancel command (outside of conversation)
bot.command('cancel', async (ctx) => {
  await ctx.conversation.exit('form-filling');
  await ctx.reply('No form in progress. Send /forms to start one.');
});

// Handle form selection from inline keyboard
bot.callbackQuery(/^form:(.+)$/, async (ctx) => {
  const formId = ctx.match[1];

  if (!schemas.has(formId)) {
    await ctx.answerCallbackQuery({ text: 'Form not found' });
    return;
  }

  ctx.session.selectedFormId = formId;
  await ctx.answerCallbackQuery();

  // Enter the form-filling conversation
  await ctx.conversation.enter('form-filling');
});

// Start the bot
bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} is running`);
    console.log(`Available forms: ${[...schemas.keys()].join(', ')}`);
  },
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
