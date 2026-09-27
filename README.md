# ChatSphere

Chatbot IA intégrable dans n'importe quel site via un script JS. Propulsé par Ollama (100% local) ou OpenRouter (cloud).

## Prérequis

- Node.js 18+
- [Ollama](https://ollama.com) installé et en cours d'exécution
- Un modèle Ollama téléchargé : `ollama pull llama3.2:1b`

## Démarrage

### 1. Backend

```bash
cd backend
npm install
npm run dev
# → http://localhost:3001
```

Le backend lit sa configuration depuis `backend/.env`. Si ce fichier n'existe pas, copiez le modèle fourni :

```bash
cp backend/.env.example backend/.env
```

Puis éditez-le et renseignez au minimum `ADMIN_TOKEN` :

```env
PORT=3001
ADMIN_TOKEN=<générez avec : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
OLLAMA_HOST=http://localhost:11434
DASHBOARD_ORIGIN=http://localhost:5173
# PUBLIC_URL=https://api.monsite.com   ← décommenter en production
```

> Si `ADMIN_TOKEN` est absent, le backend refuse de démarrer.

### 2. Dashboard

```bash
cd dashboard
npm install
npm run dev
# → http://localhost:5173
```

Le dashboard lit ses variables d'environnement depuis `dashboard/.env` (copié depuis `.env.example`) :

```env
# URL du backend (sans slash final)
VITE_API_URL=http://localhost:3001
```

> En développement, ce fichier est déjà fourni et pré-rempli. Ne changez rien.
> En production, remplacez `http://localhost:3001` par l'URL publique de votre serveur.
> Le snippet d'intégration affiché dans le dashboard utilisera automatiquement cette valeur.

### 3. Se connecter au dashboard

1. Ouvre http://localhost:5173
2. Un **écran de connexion** s'affiche — copiez la valeur `ADMIN_TOKEN` depuis `backend/.env`
3. Collez-la dans le champ et cliquez "Accéder au dashboard"
4. La session est mémorisée jusqu'à la fermeture de l'onglet (sessionStorage)

### 4. Créer un bot

1. Cliquez "Nouveau bot"
2. Remplissez le nom, le prompt système, la couleur, etc.
3. Sauvegardez → vous obtenez un **Bot ID** et le snippet d'intégration

### 5. Intégrer dans un site

Collez cette ligne **avant `</body>`** dans n'importe quel site HTML :

```html
<script
  src="http://localhost:3001/widget/widget.js"
  data-bot-id="TON_BOT_ID"
  data-server="http://localhost:3001">
</script>
```

> Le widget se charge depuis n'importe quelle origine — pas besoin de token.

### 6. Tester avec la démo

Ouvrez `demo.html` dans un navigateur (remplacez `YOUR_BOT_ID` par votre vrai ID).

---

## Démarrage avec Docker (recommandé en production)

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) et [Docker Compose](https://docs.docker.com/compose/) installés

### Lancement

```bash
# 1. Copier et remplir le fichier de configuration backend
cp backend/.env.example backend/.env
# Éditez backend/.env et renseignez ADMIN_TOKEN

# 2. Démarrer toute la stack (backend + dashboard + Ollama)
docker compose up -d

# 3. Télécharger un modèle Ollama (une seule fois)
docker exec chatsphere-ollama ollama pull llama3
```

Accédez ensuite à :
- **Dashboard** : http://localhost:5173
- **Backend API** : http://localhost:3001
- **Ollama** : http://localhost:11434

### Services Docker

| Conteneur | Image | Port |
|-----------|-------|------|
| `chatsphere-backend` | Node.js 20 (build local) | 3001 |
| `chatsphere-dashboard` | Nginx Alpine + build Vite | 5173 → 80 |
| `chatsphere-ollama` | `ollama/ollama:latest` | 11434 |

### Données persistantes

Les données survivent aux redémarrages grâce aux volumes Docker :

| Volume | Contenu |
|--------|---------|
| `chatsphere_backend_data` | Base SQLite + backups |
| `chatsphere_ollama_data` | Modèles téléchargés |

```bash
# Voir les volumes
docker volume ls | grep chatsphere

# Arrêter sans supprimer les données
docker compose down

# Arrêter ET supprimer les données (attention : irréversible)
docker compose down -v
```

### Déploiement sur un serveur distant

Modifiez `VITE_API_URL` dans `docker-compose.yml` pour pointer vers votre domaine :

```yaml
args:
  VITE_API_URL: https://api.mondomaine.com
```

Et dans `backend/.env` :
```env
DASHBOARD_ORIGIN=https://dashboard.mondomaine.com
PUBLIC_URL=https://api.mondomaine.com
```

---

## Structure

```
chatsphere/
├── backend/
│   ├── server.js          # API REST + WebSocket → Ollama / OpenRouter
│   ├── Dockerfile         # Image Node.js pour Docker
│   ├── .env.example       # Modèle de configuration (à copier en .env)
│   ├── chatsphere.db      # Base SQLite (auto-créée, non commitée)
│   └── backups/           # Backups quotidiens auto (7 jours glissants)
├── widget/
│   └── widget.js          # Script embeddable (servi par le backend)
├── dashboard/
│   ├── src/
│   │   ├── App.jsx                  # Orchestrateur principal
│   │   ├── components/              # Composants React isolés
│   │   │   ├── icons.jsx
│   │   │   ├── ui.jsx
│   │   │   ├── LoginScreen.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── BotForm.jsx
│   │   │   └── EmbedSnippet.jsx
│   │   └── hooks/
│   │       └── useAdminApi.js       # Logique d'appels API centralisée
│   ├── Dockerfile         # Build Vite + Nginx Alpine
│   ├── nginx.conf         # Config Nginx (SPA routing + cache)
│   └── .env.example       # Modèle de configuration (VITE_API_URL)
├── docker-compose.yml     # Stack complète en une commande
└── demo.html              # Exemple d'intégration du widget
```

## Persistance des données

Les configurations des bots sont stockées dans une **base SQLite** (`chatsphere.db`) via `better-sqlite3`.

### Avantages vs l'ancien fichier JSON

| Fonctionnalité | Ancien JSON | SQLite |
|----------------|-------------|--------|
| Écritures concurrentes | Risque de corruption | Sûr (mode WAL) |
| Transactions atomiques | Non | Oui |
| Protection contre injections | Non | Oui (requêtes préparées) |
| Backup automatique | Non | Oui (quotidien, 7 jours) |
| Horodatage créé/modifié | Non | Oui (`created_at`, `updated_at`) |

### Migration automatique

Si un ancien fichier `configs.json` existe, ses données sont **importées automatiquement** dans SQLite au premier démarrage du backend, puis `configs.json` est renommé en `configs.json.migrated` (archive).

### Backups

Un backup complet de la base est créé dans `backend/backups/` :
- Au démarrage du serveur
- Puis toutes les 24 heures
- Les backups de plus de 7 jours sont supprimés automatiquement

---

## Sécurité

### Ce qui est protégé

| Route | Protection |
|-------|-----------|
| `GET /api/config/:botId` | Publique (utilisée par le widget) — retourne uniquement les champs non-sensibles |
| `GET /api/configs` | Token admin requis |
| `POST /api/config` | Token admin requis |
| `PUT /api/config/:botId` | Token admin requis |
| `DELETE /api/config/:botId` | Token admin requis |
| `GET /api/models` | Token admin requis |
| `POST /api/chat` | Publique, rate-limitée (30 msg/min/IP) |
| WebSocket | Public, rate-limité (30 msg/min/IP) |

### Rate limiting

- **Dashboard admin** : 60 requêtes / 15 minutes par IP
- **Chat (REST + WebSocket)** : 30 messages / minute par IP
- **Taille des messages** : 8 Ko maximum

### Clés OpenRouter

La clé API OpenRouter est stockée dans `configs.json` mais **n'est jamais renvoyée** par l'API REST — elle reste côté serveur.

### CORS

- Routes admin : acceptent uniquement `http://localhost:5173` (configurable via `DASHBOARD_ORIGIN` dans `.env`)
- Routes publiques (widget, chat) : acceptent toutes les origines

---

## Comment ça marche

```
Site client (HTML/React/WordPress)
    └── charge widget.js via <script>
            └── ouvre WebSocket → backend (Node.js)
                    └── stream → Ollama (local) ou OpenRouter (cloud)
```

Le dashboard React communique avec le backend via des appels REST authentifiés par token Bearer.
Le widget se connecte au backend via WebSocket pour le streaming en temps réel.
