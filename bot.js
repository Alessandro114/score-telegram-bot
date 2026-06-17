#!/usr/bin/env node
'use strict';

const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN environment variable is required.');
  console.error('Get one from @BotFather on Telegram.');
  process.exit(1);
}

const API_BASE = 'https://score.get-scala.com/api/search';

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('Score Telegram Bot started. Waiting for messages...');

// ── Helpers ──────────────────────────────────────────────────────────

function formatRevenue(value) {
  if (value == null) return 'N/A';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `€${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `€${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `€${(value / 1e3).toFixed(0)}K`;
  return `€${value.toLocaleString('en-US')}`;
}

function scoreBar(score) {
  if (score == null) return 'N/A';
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${score}/100`;
}

function gradeEmoji(grade) {
  if (!grade) return '';
  if (grade.startsWith('A')) return '🏆';
  if (grade.startsWith('B')) return '🟢';
  if (grade.startsWith('C')) return '🟡';
  if (grade.startsWith('D')) return '🟠';
  return '🔴';
}

function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function formatCompanyCard(c, index) {
  const flag = countryFlag(c.country);
  const emoji = gradeEmoji(c.grade);
  const name = escapeMarkdown(c.name || 'Unknown');
  const city = escapeMarkdown(c.city || 'N/A');
  const country = escapeMarkdown(c.country || 'N/A');
  const revenue = escapeMarkdown(formatRevenue(c.revenue));
  const netIncome = escapeMarkdown(formatRevenue(c.net_income));
  const employees = c.employees != null
    ? escapeMarkdown(c.employees.toLocaleString('en-US'))
    : 'N/A';
  const bar = escapeMarkdown(scoreBar(c.score));
  const grade = escapeMarkdown(c.grade || 'N/A');

  const header = index != null
    ? `*${index}\\. ${name}* ${flag}`
    : `*${name}* ${flag}`;

  return [
    header,
    `📍 ${city}, ${country}`,
    `💰 Revenue: ${revenue}`,
    `📊 Net Income: ${netIncome}`,
    `👥 Employees: ${employees}`,
    `${emoji} Grade: ${grade}`,
    `🎯 Score: ${bar}`,
  ].join('\n');
}

async function searchCompanies(query, limit) {
  const url = `${API_BASE}?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API returned ${res.status}`);
  }
  return res.json();
}

// ── Commands ─────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  const welcome = [
    '*🔍 SCALA Score \\- Company Lookup Bot*',
    '',
    'Search across *250M\\+* company records worldwide\\.',
    '',
    '*Commands:*',
    '🔎 `/search <query>` \\- Search companies by name',
    '🏢 `/lookup <vat>` \\- Look up a company by VAT number',
    '⌨️ Or just type a company name directly\\!',
    '',
    '*Examples:*',
    '`/search Apple`',
    '`/lookup DE123456789`',
    '`Tesla`',
    '',
    '_Powered by [SCALA Score](https://score\\.get\\-scala\\.com)_',
  ].join('\n');

  bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'MarkdownV2' });
});

bot.onText(/\/search(?:\s+(.+))?/, async (msg, match) => {
  const query = match[1];
  if (!query || !query.trim()) {
    bot.sendMessage(msg.chat.id,
      '⚠️ Usage: `/search <company name>`\n\nExample: `/search Microsoft`',
      { parse_mode: 'MarkdownV2' });
    return;
  }
  await handleSearch(msg.chat.id, query.trim());
});

bot.onText(/\/lookup(?:\s+(.+))?/, async (msg, match) => {
  const vat = match[1];
  if (!vat || !vat.trim()) {
    bot.sendMessage(msg.chat.id,
      '⚠️ Usage: `/lookup <VAT number>`\n\nExample: `/lookup DE123456789`',
      { parse_mode: 'MarkdownV2' });
    return;
  }
  await handleLookup(msg.chat.id, vat.trim());
});

// Plain text messages (not commands) treated as search
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const query = msg.text.trim();
  if (!query) return;
  await handleSearch(msg.chat.id, query);
});

// ── Handlers ─────────────────────────────────────────────────────────

async function handleSearch(chatId, query) {
  const searching = await bot.sendMessage(chatId,
    `🔎 Searching for "*${escapeMarkdown(query)}*"\\.\\.\\.`,
    { parse_mode: 'MarkdownV2' });

  try {
    const data = await searchCompanies(query, 5);

    if (!data.results || data.results.length === 0) {
      await bot.editMessageText(
        `❌ No results found for "*${escapeMarkdown(query)}*"`,
        { chat_id: chatId, message_id: searching.message_id, parse_mode: 'MarkdownV2' });
      return;
    }

    const cards = data.results.map((c, i) => formatCompanyCard(c, i + 1));
    const totalEsc = escapeMarkdown(
      data.total != null ? data.total.toLocaleString('en-US') : '?'
    );

    const response = [
      `🎯 *Results for "${escapeMarkdown(query)}"* \\(${totalEsc} total\\)`,
      '',
      cards.join('\n\n────────────────────\n\n'),
      '',
      `_Use /lookup <VAT> for detailed info_`,
    ].join('\n');

    await bot.editMessageText(response, {
      chat_id: chatId,
      message_id: searching.message_id,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error('Search error:', err.message);
    await bot.editMessageText(
      `❌ Error searching: ${escapeMarkdown(err.message)}`,
      { chat_id: chatId, message_id: searching.message_id, parse_mode: 'MarkdownV2' });
  }
}

async function handleLookup(chatId, vat) {
  const searching = await bot.sendMessage(chatId,
    `🏢 Looking up "*${escapeMarkdown(vat)}*"\\.\\.\\.`,
    { parse_mode: 'MarkdownV2' });

  try {
    const data = await searchCompanies(vat, 1);

    if (!data.results || data.results.length === 0) {
      await bot.editMessageText(
        `❌ No company found for VAT "*${escapeMarkdown(vat)}*"`,
        { chat_id: chatId, message_id: searching.message_id, parse_mode: 'MarkdownV2' });
      return;
    }

    const company = data.results[0];
    const card = formatCompanyCard(company, null);

    const response = [
      `🏢 *Company Details*`,
      '',
      card,
      '',
      `_Data from [SCALA Score](https://score\\.get\\-scala\\.com)_`,
    ].join('\n');

    await bot.editMessageText(response, {
      chat_id: chatId,
      message_id: searching.message_id,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error('Lookup error:', err.message);
    await bot.editMessageText(
      `❌ Error looking up: ${escapeMarkdown(err.message)}`,
      { chat_id: chatId, message_id: searching.message_id, parse_mode: 'MarkdownV2' });
  }
}
