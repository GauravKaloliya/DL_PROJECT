FROM node:18-slim

WORKDIR /app

# Copy everything from frontend folder
COPY . .

# Install dependencies
RUN npm ci

# Build production bundle
RUN npm run build

# Install static server
RUN npm install -g serve

EXPOSE 10000

CMD ["sh", "-c", "serve -s dist -l $PORT"]
