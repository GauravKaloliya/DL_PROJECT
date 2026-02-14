FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

RUN npm install

# Copy source
COPY . .

# Build for production
RUN npm run build

# Install lightweight static server
RUN npm install -g serve

EXPOSE 10000

# Render provides PORT env variable
CMD ["sh", "-c", "serve -s dist -l $PORT"]
