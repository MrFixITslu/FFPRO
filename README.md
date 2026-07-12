# Fire Finance Pro - Production Deployment Guide

Fire Finance Pro is a strategic personal finance hub featuring secure data synchronization, wealth forecasts, budget assistance, transaction trackers, and dynamic AI-powered insights.

This repository is fully configured for deployment on any server (including multi-tenant environments with existing Nginx/OpenResty proxies) using Docker and Docker Compose.

---

## 🚀 Quick Start Git Checklist

Before pushing this repository to GitHub or GitLab:
1. **Ensure `.gitignore` is active**: The `.gitignore` file is pre-configured to prevent pushing sensitive credentials, actual database files, and encryption keys (`.env*`, `database.json`, `encryption.key`, `data/`).
2. **Setup your `.env`**: Copy `.env.example` to `.env` on your server and fill in your secrets.
3. **Use the Docker setup**: Build and run the app cleanly in a sandboxed Docker container.

---

## 🛠️ Local & Server Installation

### 1. Configure the Environment
Copy the example environment template to create a secure, server-specific configuration:
```bash
cp .env.example .env
```

Open the newly created `.env` file and configure the settings:
*   **`APP_PORT`**: Change this to an unused port (e.g., `3010`) if port `3000` is already in use by another application.
*   **`FRONTEND_URL`**: Set this to your public IP or domain name (e.g., `http://199.223.249.193` or `https://ffpro.v79sl.duckdns.org`).
*   **`SESSION_SECRET`**: Run `openssl rand -base64 32` to generate a secure random secret key.
*   **`DATA_ENCRYPTION_KEY`**: Run `openssl rand -base64 32` to generate your 256-bit database encryption key.
*   **`GEMINI_API_KEY`**: Insert your Google Gemini API Key to enable live budget advice, portfolio analysis, and predictions.
*   **OAuth (Google & Facebook)**: Input your developer client IDs and secrets. Make sure your developer portals have the matching callback URLs matching your IP/Domain.

---

## 🐳 Docker Deployment (Recommended)

The app is fully dockerized for instant deployments. It uses a multi-stage `Dockerfile` to minimize size and optimize start speeds.

### Start the Application
To build and start the container in the background:
```bash
docker compose up -d --build
```

### Stop the Application
To stop the running container:
```bash
docker compose down
```

### Check Logs
To view live logs from the application:
```bash
docker compose logs -f
```

---

## 🌐 Nginx / OpenResty Configuration

If you have multiple apps running on a single server, you can proxy incoming traffic from your public IP (`http://199.223.249.193/` or a domain name) to the application container via Nginx or OpenResty.

Add the following block to your Nginx/OpenResty server block (e.g., in `/etc/nginx/sites-available/` or `/etc/openresty/` config):

```nginx
server {
    listen 80;
    server_name 199.223.249.193; # Or your domain name

    location / {
        proxy_pass http://127.0.0.1:3010; # Match the APP_PORT set in your .env file
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Security headers
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload Nginx/OpenResty to apply:
```bash
sudo systemctl reload nginx
# or
sudo systemctl reload openresty
```

---

## 💾 Backups & Persistence

The application databases are automatically persisted in the `./data` directory on the host machine. 
*   **Database**: `./data/database.json`
*   **Encryption Key**: `./data/encryption.key`

To backup your user data, simply copy the `./data` directory to a secure off-site location.
