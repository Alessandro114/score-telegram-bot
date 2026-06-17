FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY bot.js ./

RUN chmod +x bot.js

USER node

CMD ["node", "bot.js"]
