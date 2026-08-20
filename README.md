# Lead Finder & Scraper

Google Maps Lead Scraper with Playwright automation and multi-provider AI integration (Google Gemini, OpenAI ChatGPT, Anthropic Claude, and local Ollama).

---

## Features

- **Stealth Google Maps Scraper**: Playwright-powered browser pool with anti-detection evasions, customizable concurrency, and humanized delays.
- **Comprehensive Data Extraction**: Extracts business name, category, rating, review count, address, phone number, website, social links, opening hours, and direct email contacts.
- **Multi-Provider AI (BYOK - Bring Your Own Key)**:
  - **Google Gemini**: Free tier and paid access via `gemini-2.0-flash` or `gemini-1.5-pro`.
  - **OpenAI**: Fast, affordable parsing via `gpt-4o-mini` or high-intelligence `gpt-4o`.
  - **Anthropic Claude**: Nuanced reasoning via `claude-3-5-sonnet` and `claude-3-5-haiku`.
  - **Ollama (Local)**: Zero-cloud, 100% offline intelligence for desktop environments.
- **Enterprise-Grade Security**:
  - **Zero Key Exposure**: API keys live strictly in your server-side `.env` file and are never sent to the browser or committed to Git.
  - **Prompt Injection Defense**: Input sanitization strips adversarial instruction overrides.
  - **Security Headers & Cookie Safety**: Hardened with CSP, X-Frame-Options, and secure defaults.
- **Real-Time Live Dashboard**:
  - Live progress monitoring and streaming console output via Server-Sent Events (SSE).
  - Dynamic model dropdown selector populated from active API keys.
  - Live quota & rate-limit telemetry badge.
  - Skeleton loading states and toast notifications.
  - Mobile-responsive navigation drawer.
- **Export Formats**: One-click export to CSV and JSON.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Cloud API Key** (optional, for Gemini/OpenAI/Claude) or **Ollama** (optional, for local AI)

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

## Configuration & BYOK Setup

Edit your local `.env` file to add your API keys:

```env
# Server
PORT=5000
NODE_ENV=development

# Active Provider: 'ollama', 'gemini', 'openai', or 'claude'
AI_PROVIDER=gemini

# Cloud API Keys (Keep these private!)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here

# Local Ollama AI (Desktop)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b

# Scraper
SCRAPER_CONCURRENCY=4
SCRAPER_DELAY_MIN_MS=4000
SCRAPER_DELAY_MAX_MS=8000
HEADLESS=true
```

> **Note on Quota Telemetry**: Some custom API keys (e.g. free-tier or organization-restricted) may not report remaining request quotas in HTTP response headers. Check your provider's developer console for authoritative usage limits.

---

## Running the Application

### Development Mode

Runs both the Express backend API and the Vite frontend concurrently:

```bash
npm run dev
```

- Backend API: `http://localhost:5000`
- Frontend UI: `http://localhost:5173`
- Machine-Readable Docs: `http://localhost:5000/llms.txt`

### Production Mode

Build the frontend bundle and start the server:

```bash
npm run build
npm start
```

---

## API Endpoints

### Search & Scraping
- `POST /api/search`: Start a lead extraction task with search criteria and AI provider options.
- `GET /api/search/:jobId/stream`: SSE stream for live progress updates, leads, console logs, and quota telemetry.
- `GET /api/search/:jobId/results`: Retrieve the current status and discovered leads for a job.
- `POST /api/search/:jobId/cancel`: Abort an active scraping task.

### AI Integration
- `GET /api/ai/providers`: List available AI providers and their configuration status.
- `GET /api/ai/models`: List available models for the selected provider.
- `GET /api/ai/quota`: Retrieve rate limit and quota metrics for configured providers.
- `GET /api/ai/health`: Health-check the active or requested AI provider.
- `POST /api/ai/select`: Select active AI provider and model at runtime.
- `POST /api/ai/parse`: Convert natural language prompts into structured search parameters.
- `POST /api/ai/expand`: Generate related keyword variations for broader coverage.

### Export
- `GET /api/export/csv/:jobId`: Export collected leads as a CSV file.
- `GET /api/export/json/:jobId`: Export collected leads as a JSON file.

---

## License

MIT
