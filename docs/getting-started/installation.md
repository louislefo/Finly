# Installation & Deployment

Finly offers several deployment methods depending on your target environment, ranging from a native Windows installer to headless Docker containers and manual developer environments.

---

## Method 1: Windows Installer (Recommended for Desktop)

The easiest deployment method for Windows 10 and Windows 11 workstations is the compiled setup package built with Inno Setup.

1. Download the latest installer `Finly-Setup-vX.Y.Z.exe` from the [GitHub Releases page](https://github.com/louislefo/Finly/releases/latest).
2. Execute the installer. You may select:
   - Target installation path (defaults to `%LocalAppData%\Programs\Finly`).
   - Desktop and Start Menu shortcuts.
   - Optional local Ollama assistant bundling.
3. Launch **Finly** from your Start Menu or Desktop.
4. The background launcher boots the Python backend on port `8000` and serves the Next.js interface on port `3000`.

> **Data Persistence Note**: The application database is placed in `%LocalAppData%\Programs\Finly\data\finly.db`. When updating to a newer version using the installer, your existing `finly.db` is automatically preserved.

---

## Method 2: Docker Compose (Home Server / NAS)

For 24/7 continuous synchronization on a Linux server, Raspberry Pi, or NAS (Synology, TrueNAS, Unraid):

```yaml
version: "3.8"

services:
  finly-backend:
    image: ghcr.io/louislefo/finly-backend:latest
    container_name: finly-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - SECRET_KEY=your_secure_random_key_here
      - FIRST_SUPERUSER_EMAIL=admin@finly.local
      - FIRST_SUPERUSER_PASSWORD=your_custom_password
      - DATABASE_URL=sqlite:///./data/finly.db
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
    volumes:
      - ./finly_data:/app/data
      - ./woob_data:/root/.local/share/woob

  finly-frontend:
    image: ghcr.io/louislefo/finly-frontend:latest
    container_name: finly-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://finly-backend:8000/api/v1
    depends_on:
      - finly-backend
```

Run the container fleet:

```bash
docker compose up -d
```

---

## Method 3: Manual Developer Setup

If you wish to contribute to Finly or run the codebase from source:

### Prerequisites

- **Python**: Version 3.10 or 3.11
- **Node.js**: Version 18.x or 20.x
- **Git**

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/louislefo/Finly.git
cd Finly

# Navigate to backend
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend Setup

In a secondary terminal window:

```bash
cd Finly/finly-app

# Install Node modules
npm install

# Start Next.js development server
npm run dev
```

Open your browser at `http://localhost:3000`.

---

## Initial Superuser Credentials

When Finly starts for the very first time on an empty database, it initializes the default administrator profile:

- **Username / Email**: `admin` (or `admin@finly.local`)
- **Password**: `admin`

Upon initial login, proceed immediately to the **Paramètres** (`/compte`) page to change your password.
