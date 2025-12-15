# Autumn Hotel OS (MVP)

Autumn is a "Neuro-Symbolic" revenue management MVP:
- A deterministic pricing engine (pure function) produces explainable daily rates.
- An AI "Autopilot" proposes strategy parameter changes via Generative UI (Diff Cards).
- A dashboard visualizes historical occupancy and market context, and shows projections only after strategy approval.

## Tech Stack
- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind + shadcn/ui
- Vercel AI SDK (`ai/rsc`) + OpenAI provider (`@ai-sdk/openai`)
- Recharts for visualization
- Local persistence via `db.json` (Server Actions) + Zod schemas (`lib/schema.ts`)

## Run Locally

Prereqs:
- Node.js 18.17+ (or 20+)
- An OpenAI API key

1) Install dependencies
```bash
npm install
```

2) Set env vars
```bash
cp .env.example .env.local
```
Then edit `.env.local` and set:
```
OPENAI_API_KEY=...
```

3) Start the dev server
```bash
npm run dev
```
Open `http://localhost:3000`.

4) Load data (choose one)
- Upload your reservation CSV in the onboarding overlay, or
- Click "Use Demo Data", or
- Run a demo seed from the terminal:
```bash
npm run seed
```

5) Reset the local database (optional)
```bash
npm run reset-db
```

## Production Build
```bash
npm run build
npm run start
```

## Data & Secrets (Public Repo Safe)
- Never commit `.env.local` or API keys. Use `.env.example` as a template.
- `db.json` and real hotel CSVs are intentionally ignored by git.
- If you ever committed a key, rotate it immediately and purge git history before going public.
