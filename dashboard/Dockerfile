# ── Dashboard ChatSphere — build multi-stage ──────────────────────────────
# Étape 1 : build Vite
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_API_URL est passé au moment du build via --build-arg
# pour être intégré dans le bundle JS statique
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Étape 2 : servir avec Nginx (image ultra-légère)
FROM nginx:alpine

# Copier le build Vite dans le dossier de Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuration Nginx personnalisée (SPA routing + proxy backend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
