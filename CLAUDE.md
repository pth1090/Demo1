# CLAUDE.md

This file provides guidance to AI assistants (Claude and others) working in this repository. Update it as the project evolves.

---

## Repository Overview

- **Repo**: pth1090/demo1
- **Project**: HaiFisch Template Editor — a web-based editor for `.devt` driver template files
- **Stack**: Python 3.11 + FastAPI (backend) · React 18 + Vite + Tailwind CSS (frontend) · SQLite
- **Deployment**: Docker Compose (`docker compose up --build`)
- **Primary branch**: `main`

---

## Repository Structure

```
Demo1/
├── CLAUDE.md
├── docker-compose.yml       # Production + dev profiles
├── .env.example             # Environment variable template
├── .gitignore
├── backend/
│   ├── Dockerfile           # Multi-stage: builds frontend then runs FastAPI
│   ├── requirements.txt
│   ├── main.py              # FastAPI app entry point, serves React SPA from /static
│   ├── database.py          # SQLAlchemy async engine, WAL mode, get_db dependency
│   ├── models.py            # ORM: Template, TemplateField, SchemaConfig
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── routers/
│   │   ├── templates.py     # CRUD, import (.devt upload), export (.devt download)
│   │   └── schema_config.py # Schema config CRUD + /apply endpoint
│   ├── services/
│   │   ├── devt_parser.py   # Parses .devt INI-like format into structured fields
│   │   └── devt_serializer.py # Writes fields back to .devt format
│   ├── static/              # React build output (populated by `npm run build`)
│   └── data/
│       └── templates.db     # SQLite database (git-ignored)
└── frontend/
    ├── package.json
    ├── vite.config.ts       # outDir → ../backend/static
    ├── tailwind.config.ts
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx          # React Router setup
    │   ├── index.css        # Tailwind base
    │   ├── api/client.ts    # Axios + typed API functions
    │   ├── components/
    │   │   ├── TemplateList.tsx      # Home page: list, search, import
    │   │   ├── TemplateEditor.tsx    # Editor: Übersicht / Signale / Raw tabs
    │   │   └── SchemaConfigPanel.tsx # Settings: define field schemas
    │   ├── hooks/
    │   │   ├── useTemplates.ts
    │   │   └── useSchemaConfig.ts
    │   └── types/index.ts
```

---

## Build & Run

### Production (single Docker container)

```bash
cp .env.example .env
docker compose up --build
```

App available at `http://localhost:8000` (or `http://<server-ip>:8000` for colleagues).

### Development (hot reload)

```bash
# Terminal 1 — Backend with live reload
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Terminal 2 — Frontend dev server (proxies /api → localhost:8000)
cd frontend
npm install
npm run dev
```

Frontend dev server at `http://localhost:5173`.

### Build frontend only

```bash
cd frontend && npm run build   # outputs to ../backend/static/
```

---

## Environment Variables (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Backend listen port |
| `DB_PATH` | `data/templates.db` | SQLite file path |
| `LOG_LEVEL` | `info` | Uvicorn log level |

---

## API Reference

All endpoints under `/api/v1/`. Interactive docs at `http://localhost:8000/docs`.

| Method | Path | Description |
|---|---|---|
| GET | `/templates` | List all templates |
| POST | `/templates` | Create template |
| GET | `/templates/{id}` | Get template with fields |
| PUT | `/templates/{id}` | Update template |
| DELETE | `/templates/{id}` | Delete template |
| POST | `/templates/import` | Upload .devt file |
| GET | `/templates/{id}/export` | Download .devt file |
| POST | `/templates/parse-preview` | Parse .devt without saving |
| GET/POST/PUT/DELETE | `/schema-configs/...` | Schema config CRUD |
| POST | `/schema-configs/{id}/apply` | Re-parse all templates |
| GET | `/health` | Health check |

---

## devt File Format

The `.devt` format is INI-like with four section types:

```
[HiTec-Zang]          — File header (version, export date)
[{GUID}]              — Device definition (main parameters)
[...SIGNAL_NAME]      — Signal/channel definition
[DeviceList]          — Device index
```

Special encoding: pipe-separated values (`key=val | key2=val2`), list fields
(`In.ListCount` / `In.List0`), status blocks (`Status.Count` / `Status.Value0`),
bilingual fields (`Name` DE / `Name_ENU` EN), BMP symbol blob.

---

## Code Conventions

- **Python**: No formatter enforced; follow PEP 8. Async SQLAlchemy throughout.
- **TypeScript**: Strict mode. React Query for server state. No Redux.
- **Naming**: snake_case in Python, camelCase in TypeScript, kebab-case in filenames.
- **No auth**: Internal tool — CORS allows all origins.

---

## Key Conventions for AI Assistants

1. **Read before editing.** Always read a file before modifying it.
2. **No speculative abstractions.** Only add complexity the current task actually requires.
3. **No unrequested features.** Implement exactly what is asked — no more.
4. **No unnecessary files.** Prefer editing existing files over creating new ones.
5. **Security first.** Never introduce SQL injection, XSS, command injection, or other OWASP Top 10 vulnerabilities.
6. **No secrets in commits.** Never commit `.env` files, credentials, or API keys.
7. **Confirm before destructive actions.** Ask before force-pushing, deleting branches, or dropping data.
8. **Keep this file current.** Update CLAUDE.md whenever the project structure, commands, or conventions change significantly.

---

## GitHub Integration

- **MCP tool scope**: restricted to `pth1090/demo1` only.
- Do **not** create a pull request unless explicitly asked.
- Do **not** push to branches other than the one designated for the current task.

---

*Last updated: 2026-04-14 — HaiFisch Template Editor*
