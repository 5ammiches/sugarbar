<div align="center">
  <img src="./public/logo-readme.png" alt="SugarBar logo" width="800" />
</div>

# SugarBar

Relive iconic hip‑hop lyrics—AI‑extracted, time‑synced, and played back
karaoke style.

- 📸 Demo: Coming soon
- ⏱️ Status: Work in progress

## 🚀 Features 🚀

- 🎵 AI‑Curated Lyric Moments: NLP selects the most contextually powerful bars from tracks and eras you love.
- ⏱️ Word‑Level Sync: Karaoke‑style highlighting with precise timestamps aligned via OpenAI Whisper/stable-ts.
- 🔊 Audio Snippets Playback: Hear the exact moment that matches the lyric—short, shareable clips.
- 📚 Classic Albums Library: A growing bank of hip‑hop classics spanning multiple eras for richer discovery.
- 🔎 Smart Search (planned): Find moments by artist, album, era, theme, or keywords.
- 🧭 Filters (planned): Slice by decade, region, sub‑genre, mood, and more.
- 📱 Responsive UI: Built with Tailwind + shadcn/ui for a smooth desktop and mobile experience.
- ⚙️ Typed & Safe: Zod‑validated schemas and Convex backend for reliable, real‑time interactions.
- 📝 Sources (for research/demo): Lyrics and timings are derived for demo purposes using publicly available pages from Genius/Musixmatch; no official APIs are used.

## ⚡️ Tech Stack ⚡️

- [TanStack Start](https://tanstack.com/start)
- [Crawl4AI](https://docs.crawl4ai.com/)
- [Convex](https://www.convex.dev/)
- [Zod](https://zod.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

## 💨💨 Run SugarBar Locally 💨💨

SugarBar is in-progress. You can run:

- lyrics-service (FastAPI) to fetch lyrics from Genius/Musixmatch pages via Crawl4AI
- Convex backend + Vite dev server (no UI yet)
- Spotify metadata is fetched by Convex functions, not a separate service

1. Clone the repository

```bash
git clone https://github.com/your-user/sugarbar.git
cd sugarbar
```

2. Set up environment variables

A) Root app (.env or .env.local in project root)

```bash
# Convex
CONVEX_DEPLOYMENT=dev:your-project-name
VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
# Spotify (used by Convex functions to fetch metadata)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

Notes:

- Create a Convex project (free) and copy the deployment name/URL from the Convex dashboard.
- Spotify credentials come from the Spotify Developer Portal.

B) Lyrics Service (lyrics-service/.env)

```bash
# Genius credentials (if you use them)
GENIUS_CLIENT_ACCESS_TOKEN=
GENIUS_CLIENT_ID=
GENIUS_CLIENT_SECRET=

# Crawl4AI BrowserProfiler directory for Musixmatch scraping
# See: https://docs.crawl4ai.com/advanced/identity-based-crawling/#creating-and-managing-profiles-with-browserprofiler
MUSIXMATCH_PROFILE_PATH=/absolute/path/to/your/browser-profile
```

Notes:

- The lyrics-service scrapes public lyric pages (no official APIs). Use responsibly and comply with site terms.
- MUSIXMATCH_PROFILE_PATH enables persistent identity for Musixmatch; required to reduce challenges.

3. Install dependencies

Root (web app + Convex):

```bash
pnpm install
```

Lyrics service (FastAPI + uv):

```bash
cd services/lyrics-service
uv venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
uv pip install -e .
# If you keep a requirements file, also:
# uv pip install -r requirements.txt
```

4. Run services in development

A) Start the lyrics-service (FastAPI)

```bash
cd lyrics-service/
source .venv/bin/activate
python run_server.py
```

- Open Swagger UI: http://127.0.0.1:8000/docs
- Endpoint:
  - GET /lyrics/{source}
    - source: genius | musixmatch
    - Query: title, artist
    - Example:
      http://127.0.0.1:8000/lyrics/genius?title=Juicy&artist=The%20Notorious%20B.I.G.

B) Start Convex + Vite (no UI yet, validates backend/dev env)

```bash
pnpm run dev
```

- This runs both:
  - convex dev
  - vite dev --port 3000
- Open http://localhost:3000 (placeholder app shell)

5. Optional: run Spotify metadata fetching (Convex functions)

- With SPOTIFY_CLIENT_ID/SECRET set in your root .env, you can trigger the Convex functions that fetch artists/albums/tracks metadata (see convex/spotify.ts). Run the app with `pnpm run dev` and invoke the functions via your development hooks or temporary routes.

Project structure (key parts)

```
sugarbar/
├─ convex/                  # Convex backend
│  ├─ _generated/
│  ├─ schema.ts
│  ├─ db.ts
│  ├─ bars.ts
│  ├─ spotify.ts            # Spotify metadata functions
│  ├─ auth.config.ts
│  └─ tsconfig.json
├─ lyrics-service/       # FastAPI lyrics microservice
│   ├─ app/
│   ├─ run_server.py
│   ├─ pyproject.toml
|   ├─.env
│   └─ README.md
├─ src/                     # TanStack Start app (UI WIP)
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/
│  ├─ routes/
│  ├─ styles/
│  ├─ utils/
│  ├─ routeTree.gen.ts
│  └─ router.tsx
├─ public/                  # Static assets
├─ package.json
├─ .env(.local)
└─ README.md
```

What’s not in this preview

- Audio playback and alignment are not wired up yet (no audio pipeline in the app).

Security

- Do not commit .env files or browser profiles.
- Rotate credentials regularly.

Troubleshooting

- Musixmatch scraping fails/challenges: verify MUSIXMATCH_PROFILE_PATH and follow the Crawl4AI profile guide.
- Empty lyric results: website markup may change; update selectors/scraper logic.
- Convex errors: ensure CONVEX_DEPLOYMENT and VITE_CONVEX_URL match your dashboard values.

## 📝 Scripts 📝

| Script       | Description                                           |
| ------------ | ----------------------------------------------------- |
| `dev`        | Runs `convex dev` and `vite dev` in parallel.         |
| `dev:convex` | Starts Convex development server.                     |
| `dev:vite`   | Starts Vite dev server on port 3000.                  |
| `seed`       | Starts Convex once and imports sample data.           |
| `build`      | Builds the Vite app.                                  |
| `start`      | Starts the built server (`.output/server/index.mjs`). |

Contributions and feedback are welcome while the core UI/audio pipeline is under development.
