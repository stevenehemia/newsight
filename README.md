# Newsight

Search several news providers at once, drill down into the results, and bookmark articles.

**Live: <https://newsight-u1se.onrender.com>**

> Hosted on Render's free tier, which spins the container down after 15 minutes of inactivity.
> This may delay requests by 50 seconds or more on cold starts.

---

## What it does

- Searches **Hacker News**, **The New York Times** and **The Guardian** from one query and merges
  the results newest-first.
- Shows summary, source, section, author, and date for each article, linking to the original.
- **Filters** the results by source, section and date (client-side).
- **Remembers recent searches** and keeps the search term in the URL
- **Bookmarks** articles to a page of their own at `/bookmarks`.

## Running locally

Requires **JDK 21**, and **Node 24** for the frontend.

**API keys are optional.** Hacker News needs none, and any provider whose key is missing switches
itself off with a log line while the rest keep working — so the app runs with zero setup. For the
full three sources, copy `.env.example` and set `NYT_API_KEY` and `GUARDIAN_API_KEY` in your
environment.

The two builds are not coupled. Development needs both servers:

```bash
./mvnw spring-boot:run                               # terminal 1 — backend on :8080
cd src/main/frontend && npm install && npm run dev   # terminal 2 — Vite on :5173
```

Open **<http://localhost:5173>**. Vite proxies `/api` to the backend so the browser sees a single
origin. Hitting `:8080` directly serves no UI in development; the frontend is only baked into the
jar at Docker build time.

### Tests

```bash
./mvnw test                                  # 44 backend tests
cd src/main/frontend && npm test              # 59 frontend tests
cd src/main/frontend && npm run lint          # oxlint
cd src/main/frontend && npm run build         # tsc -b + vite build
```

CI runs two jobs on every push: `./mvnw -B verify` for the backend, and `npm ci` / `lint` / `test` /
`build` for the frontend.

## How things fit together

```
React (Vite)  ──/api/news/search?q=──▶  NewsController
                                             │
                                        NewsService
                                             │
                    ┌────────────────────────┼────────────────────────┐
              HackerNewsSource          NytSource              GuardianSource
```

## Built with

Java 21 · Spring Boot 4.1.1 · JUnit 6 · React 19 · TypeScript · Vite · Vitest · Docker (multi-stage,
non-root) · deployed on Render
