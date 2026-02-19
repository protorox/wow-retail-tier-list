FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run prisma:generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
