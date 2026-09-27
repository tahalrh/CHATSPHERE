# ── Backend ChatSphere ────────────────────────────────────────────────────
# Image Node.js LTS slim (moins de surface d'attaque qu'alpine pour better-sqlite3)
FROM node:20-slim

# Dépendances système pour compiler better-sqlite3 (module natif)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier les manifestes en premier pour profiter du cache Docker
COPY package.json package-lock.json ./

# Installer uniquement les dépendances de production
RUN npm ci --omit=dev

# Copier le reste des sources
COPY server.js ./

# Dossier de données persistantes (DB + backups) — monté en volume
RUN mkdir -p /app/data/backups

# Le fichier .env est injecté via docker-compose (env_file ou environment)
# Ne jamais COPY le .env dans l'image

EXPOSE 3001

CMD ["node", "server.js"]
