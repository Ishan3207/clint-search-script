# Lead Finder & Scraper

Google Maps Lead Scraper with Playwright automation and local AI integration via Ollama.

---

## Features

- **Stealth Google Maps Scraper**: Playwright-powered browser pool with anti-detection evasions, customizable concurrency, and humanized delays.
- **Comprehensive Data Extraction**: Extracts business name, category, rating, review count, address, phone number, website, social links, opening hours, and direct email contacts.
- **Local AI Intelligence (Ollama)**: 
  - Natural language search query parsing.
  - Keyword and query expansion for improved lead coverage.
  - Automated lead qualification and scoring.
- **Real-Time Live Dashboard**:
  - Live progress monitoring and streaming console output via Server-Sent Events (SSE).
  - Interactive results table with instant search and status filters.
- **Export Formats**: One-click export to CSV and JSON.
- **Configurable Worker Pool**: Manage headless browser concurrency, timeout thresholds, and rate limits.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Ollama** (Optional, for AI features): Running locally with a supported model (e.g., `gemma3:4b` or `llama3`)

---

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd clint-search-script
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install Playwright browser binaries**:
   ```bash
   npm run install-browsers
   ```

4. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```

---

## Configuration

Edit the `.env` file to customize scraper and AI settings:

```env
# Server
PORT=5000

# Ollama AI
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b

# Scraper
SCRAPER_CONCURRENCY=4
SCRAPER_DELAY_MIN_MS=4000
SCRAPER_DELAY_MAX_MS=8000
HEADLESS=true
```

---

## Running the Application

### Development Mode

Runs both the Express backend API and the Vite frontend concurrently:

```bash
npm run dev
```

- Backend API: `http://localhost:5000`
- Frontend UI: `http://localhost:5173`

### Production Mode

Build the frontend bundle and start the server:

```bash
npm run build
npm start
```

---

## API Endpoints

### Search & Scraping
- `POST /api/search/start`: Start a lead extraction task with search criteria.
- `GET /api/search/stream/:jobId`: SSE stream for live progress updates and console logs.
- `GET /api/search/status/:jobId`: Retrieve the current status and discovered leads for a job.
- `POST /api/search/stop/:jobId`: Abort an active scraping task.

### AI Integration
- `POST /api/ai/parse`: Convert natural language prompts into structured search parameters.
- `POST /api/ai/expand`: Generate related keyword variations for broader coverage.
- `POST /api/ai/score`: Analyze and score extracted lead relevance.

### Export
- `GET /api/export/csv/:jobId`: Export collected leads as a CSV file.
- `GET /api/export/json/:jobId`: Export collected leads as a JSON file.

---

## Project Structure

```text
├── frontend/             # Vite frontend application
│   ├── index.html        # Main HTML layout
│   ├── vite.config.js    # Vite configuration
│   └── src/
│       ├── components/   # UI components (search form, table, progress bar, logs)
│       └── styles/       # Design system and stylesheets
├── src/
│   ├── ai/               # Ollama AI integration (query expander, lead filter, parser)
│   ├── scraper/          # Playwright browser pool, stealth handlers, and scrapers
│   └── server/           # Express application, routes, and SSE search manager
├── .env.example          # Environment variable template
├── package.json          # Project metadata, dependencies, and npm scripts
└── README.md             # Project documentation
```

---

## License

MIT
