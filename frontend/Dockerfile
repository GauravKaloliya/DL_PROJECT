FROM node:18-slim

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Verify package files exist before npm install
RUN ls -la *.json || echo "No package files found"

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Build for production
RUN npm run build

# Install lightweight static server
RUN npm install -g serve

EXPOSE 10000

# Render provides PORT env variable
CMD ["sh", "-c", "serve -s dist -l $PORT"]
