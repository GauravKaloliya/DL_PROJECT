FROM node:18-slim

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

RUN npm install -g serve

EXPOSE 10000

CMD ["sh", "-c", "serve -s dist -l $PORT"]
