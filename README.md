# Score Telegram Bot

Telegram bot to search 250M+ company records from [SCALA Score](https://score.get-scala.com).

## Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Copy the bot token

### Run with Node.js

```bash
npm install
TELEGRAM_BOT_TOKEN=your_token_here node bot.js
```

### Run with Docker

```bash
docker build -t score-telegram-bot .
docker run -d --name score-bot -e TELEGRAM_BOT_TOKEN=your_token_here score-telegram-bot
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/search <query>` | Search companies by name (top 5) |
| `/lookup <vat>` | Look up a company by VAT number |
| *plain text* | Treated as a search query |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |

## License

MIT
