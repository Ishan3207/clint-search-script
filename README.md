# Lead Finder - Businesses Without Websites (Free & API Modes)

A minimal, stark **monochrome web application** and **Python script** designed to find local business leads without websites.

---

## 🌟 Highlights

- **100% Free Default Engine (OpenStreetMap)**: Requires **NO API key, NO credit card, and NO signup**. Out of the box, you can run unlimited lead searches for free.
- **Optional Google Places Engine**: Included as a toggle option if you have a Google Places API key.
- **Dynamic Provider Toggle**: The API Key input field is hidden by default and only appears when Google Places is selected.
- **Monochrome Web UI**: High-contrast, clean, zero-flashiness design.
- **Live Search Console**: Real-time progress updates and lead populating via Server-Sent Events (SSE).
- **CSV Export**: Single-click download for all discovered leads.
- **GitHub Security**: Complete `.gitignore` and `.env.example` to prevent committing API keys or CSV files.

---

## 🚀 Quick Start (Node.js Web App)

### 1. Installation

```bash
# Clone the repository
git clone <your-repository-url>
cd clint-search-script

# Install dependencies
npm install
```

### 2. Run the App (No Key Needed for OpenStreetMap!)

```bash
npm start
```

Open your browser and navigate to:
**`http://127.0.0.1:5000`**

- By default, **OpenStreetMap (100% Free)** is selected.
- Simply enter your target **Niche** (e.g. `carpenter`, `plumber`), **Latitude**, and **Longitude**, then click **START SEARCH**!

---

## 🐍 Python CLI Script Usage

Run the 100% free OpenStreetMap search directly from Python:

```bash
python script.py
```

Results will be saved to `no_website_leads_free.csv`.

---

## 🔐 Security Notice

This repository includes a `.gitignore` pre-configured to ignore `.env`, `node_modules/`, and generated `*.csv` files.
