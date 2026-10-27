# Scam Check for LinkedIn

Paste a LinkedIn **message**, **job post** or **profile**. Get a **0–100% risk score**, a **Safe / Suspicious / High risk** verdict, every red flag explained, and a checklist of what to do next. Recent scans are saved to a database.

**How it works: two layers**

1. **Rules (instant, offline).** Regex and keyword checks for crypto talk, Telegram/WhatsApp redirects, wire transfers, upfront fees, fake cheques, personal email addresses on "corporate" roles, urgency, look-alike LinkedIn links and more.
2. **AI (optional).** A free or cheap LLM (Groq, Gemini or OpenAI) looks for impersonation and social-engineering tricks the rules cannot see.

The two scores are blended. If the AI key is missing or the AI call fails, you still get a rules-only result.

```
.
├── src/app/
│   ├── page.js                  Dashboard (tabs, gauge, flags, history)
│   ├── layout.js, globals.css   Fonts, theme tokens (light/dark)
│   └── api/
│       ├── analyze/route.js     POST: run both layers, save the scan
│       └── history/route.js     GET: list scans, DELETE: clear them
├── lib/
│   ├── scamRules.js             ★ Rules, weights, thresholds, tips, AI prompts
│   ├── heuristics.js            Rule engine + score blending
│   ├── ai.js                    Groq / Gemini / OpenAI client (plain fetch)
│   ├── db.js                    Postgres (Prisma) ⇄ SQLite ⇄ memory, auto-selected
│   ├── privacy.js               ★ Retention days, rate limit, history on/off
│   ├── visitor.js, rateLimit.js Anonymous visitor cookie, per-IP limiter
│   └── uiConfig.js              UI wording, example texts, colour classes
├── components/                  RiskGauge.js, HistoryDrawer.js
├── prisma/schema.prisma         Scan model
└── .env.example
```

---

## Part 1: Run it locally in VS Code (about 5 minutes)

**Prerequisites**

- [Node.js 20.9 or newer, the current LTS (22 or 24) is best](https://nodejs.org). Check with `node -v` in a terminal.
- [VS Code](https://code.visualstudio.com).
- Optional: [Git](https://git-scm.com), needed for Part 4.

**Steps**

1. Unzip the project and open the folder in VS Code (**File → Open Folder**).
2. Open the built-in terminal (**Terminal → New Terminal**).
3. Install packages:
   ```bash
   npm install
   ```
4. Create your settings file. Copy `.env.example` to `.env.local`:
   - macOS / Linux: `cp .env.example .env.local`
   - Windows PowerShell: `Copy-Item .env.example .env.local`
5. Start the app:
   ```bash
   npm run dev
   ```
6. Open <http://localhost:3000>. Click **scam** under "Try an example", then **Check for scam signs**.

**With an empty `.env.local` it already works:** rules-only analysis, history saved in a local SQLite file at `data/scans.db`. Add the AI key (Part 3) and a cloud database (Part 2) when you are ready.

> If `npm install` prints a warning about `better-sqlite3`, ignore it. SQLite is optional, and the app falls back to in-memory history. Setting up Postgres (Part 2) avoids the issue.

---

## Part 2: Free cloud database (Supabase or Neon)

You need this for Vercel, because Vercel's disk is wiped between requests. Pick **one**.

### Option A: Neon (simplest)

1. Sign up at <https://neon.tech> and click **Create project**.
2. On the project dashboard, click **Connect** and copy the connection string. It looks like `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`.
3. Paste it into `.env.local`:
   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require
   ```

### Option B: Supabase

1. Sign up at <https://supabase.com> and click **New project**. Save the database password you choose.
2. Open your project, then click the **Connect** button at the top of the dashboard.
3. In the panel, open the **Direct** tab (not Framework, MCP, Server or ORM). Change the connection **Method** to **Session pooler** (not "Direct connection" and not "Transaction pooler"). It works on every network, including IPv4-only ones. Copy the connection string. It looks like:
   ```
   postgres://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres
   ```
   The port at the end must be **5432**, and the username must be the long form `postgres.<project-ref>`. The `aws-0` or `aws-1` part of the host varies by project, so copy it exactly as shown.
4. In the string, replace `[YOUR-PASSWORD]` with the database password you chose in step 1, and remove the square brackets. If the password contains symbols such as `@`, `#` or `/`, replace each with its URL-encoded form (`@` becomes `%40`, `#` becomes `%23`, `/` becomes `%2F`), or reset the password to letters and numbers only under **Project Settings → Database**.
5. Open `.env.local` in VS Code and paste it as one line, with no quotes and no spaces:
   ```
   DATABASE_URL=postgres://postgres.abcdefghijklmnop:YourPassword123@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```
6. Save the file and continue with "Then" below.

### Then

Restart `npm run dev`. The app creates the `Scan` table itself on first use. If you prefer Prisma to do it, run `npm run db:push` once.

Open **Recent scans**: the header should say "Stored in PostgreSQL". If it says "local SQLite" or shows a yellow note, the connection string is wrong. The note tells you why.

**Switching back to SQLite:** empty `DATABASE_URL`. No code changes.

---

## Part 3: Free AI key (Groq or Gemini)

### Groq (fast, generous free tier)

1. Go to <https://console.groq.com> and sign in.
2. Open **API Keys → Create API Key**. Copy the key (starts with `gsk_`).
3. In `.env.local`:
   ```
   AI_API_KEY=gsk_your_key_here
   ```

### Google Gemini

1. Go to <https://aistudio.google.com/apikey> and click **Create API key**.
2. Copy the key. New keys start with `AQ.`, older ones with `AIza`. Both work.
3. In `.env.local`:
   ```
   AI_API_KEY=AQ.your_key_here
   ```

### OpenAI (paid, optional)

Create a key at <https://platform.openai.com/api-keys> (starts with `sk-`) and set it as `AI_API_KEY`.

**What to put in `.env.local`:** only `AI_API_KEY`. Leave `AI_PROVIDER` and `AI_MODEL` empty (or delete those lines).

- `AI_PROVIDER` is detected from the key prefix (`gsk_` = Groq, `AQ.` or `AIza` = Gemini, `sk-` = OpenAI). Set it only if detection guesses wrong: `AI_PROVIDER=gemini`.
- `AI_MODEL` picks a specific model. Leave it empty and the app uses a built-in default for your provider. If that model has been retired (providers do this often), the app automatically tries the next one in its list (see `PROVIDERS` in `lib/ai.js`).
- Current defaults: Groq `openai/gpt-oss-120b`, Gemini `gemini-3-flash-preview`, OpenAI `gpt-4o-mini`.
- Set `AI_MODEL` yourself only if you see "model not found" or want a different model. Copy the exact name from [Groq's model list](https://console.groq.com/docs/models) or [Gemini's model list](https://ai.google.dev/gemini-api/docs/models). Older names such as `gemini-2.5-flash` and `llama-3.3-70b-versatile` have been shut down and will not work.

Restart `npm run dev`. After a scan, the result panel says which AI scored it. If the AI fails, the panel shows the error and still returns the rules result.

> No SDK is needed. `lib/ai.js` calls the providers' OpenAI-compatible HTTP endpoints directly, so `groq-sdk` and `@google/genai` are not in `package.json`.

---

## Part 4: Deploy to Vercel

1. **Create a GitHub repository.** On <https://github.com/new>, create an empty repo (no README).
2. **Push the project** from the VS Code terminal:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USER/YOUR-REPO.git
   git push -u origin main
   ```
   `.gitignore` already keeps `.env.local` out of GitHub, so your keys stay private.
   **Keys go only in `.env.local`, never in `.env.example`.** `.env.example` is uploaded to GitHub, `.env.local` is not. Run `git ls-files` before pushing: `.env.local` must not appear in the list, and `.env.example` must have empty values after the `=`.
   Run the `git` commands from inside the project folder (the one containing `package.json`) so that folder is the repository root.
3. **Import into Vercel.** Sign in at <https://vercel.com> with GitHub, click **Add New → Project**, and select your repo. Vercel detects Next.js automatically.
4. **Add environment variables** (Settings → Environment Variables, before the first deploy):
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon / Supabase string (**required**, otherwise history is lost between requests) |
   | `AI_API_KEY` | your Groq / Gemini key |
5. Click **Deploy**. In about a minute you get a public URL.

Every `git push` to `main` redeploys automatically.

**Heads-up:** without `DATABASE_URL`, Vercel can only keep history in memory, and it disappears frequently. The app still works.

---

## Part 5: Customization cheat sheet

Almost everything lives in **`lib/scamRules.js`**.

| I want to… | Edit |
|---|---|
| Add a keyword to an existing rule | The rule's `patterns` regex, e.g. add `\|ponzi` inside the `crypto` pattern |
| Add a brand-new rule | Append an object to `RULES` with `id`, `label`, `weight`, `patterns` (or a `check` function) and `explanation` |
| Make a rule matter more or less | Change its `weight` (points added to the rule score, capped at 100) |
| Run a rule only on some tabs | Add `appliesTo: ['job']` (any of `message`, `job`, `profile`) |
| Change where Suspicious / High risk start | `THRESHOLDS.suspicious` (default 30) and `THRESHOLDS.high` (default 65) |
| Trust the AI more or less | `SCORING.aiWeight` and `SCORING.heuristicWeight` (keep them summing to 1) |
| Reward dangerous combinations | `SCORING.comboBonuses` |
| Change what the AI looks for or how it answers | `SYSTEM_PROMPT` and `buildUserPrompt` |
| Change the safety checklist | `SAFETY_TIPS` |
| Change max/min input length | `INPUT_LIMITS` |

**Example: flag "work from home" as mildly suspicious**

```js
{
  id: 'wfh',
  label: 'Work-from-home pitch',
  weight: 6,
  appliesTo: ['job'],
  patterns: [/\bwork from home\b/i],
  explanation: 'Many fake jobs lead with work-from-home. Check the company independently.',
},
```

**UI changes**

- Wording, tab names, example texts: `lib/uiConfig.js`
- Colours (light and dark): the `:root` and `.dark` blocks at the top of `src/app/globals.css`
- Fonts: `src/app/layout.js`
- Gauge look: `components/RiskGauge.js`
- History drawer: `components/HistoryDrawer.js`

**Good to know**

- The app never opens LinkedIn pages. For profiles it analyses the text you paste (and checks the URL's domain), so copying the headline and About section gives better results than a bare link.
- Scores are a guide, not proof. Rules can produce false positives (a legitimate recruiter may write "urgent"), and a clever scam may avoid every rule.
- The API has no login or rate limiting. Before sharing the public URL widely, add a rate limit (for example Vercel's Firewall rules or Upstash Ratelimit) so nobody can run up your AI quota.

---

## Privacy and abuse protection (public sites)

- **Each visitor only sees their own scans.** A random anonymous ID is stored in a cookie. Scans are saved with that ID, and **Recent scans** and **Delete my scans** only touch that visitor's rows. No account is needed. Clearing cookies or switching device starts a fresh, empty history.
- **Optional text storage.** Under the text box, "Keep the pasted text in my history" can be unticked. Then only the score and red flags are stored, never the text.
- **Automatic deletion.** Scans older than 30 days are deleted (`PRIVACY.retentionDays` in `lib/privacy.js`). Rows created by older versions of this app, which had no owner, are deleted on first start.
- **History off switch.** Set `HISTORY_ENABLED=false` in `.env.local` (or in Vercel's Environment Variables) to stop saving and showing history completely.
- **Rate limit.** 15 scans per IP address per 10 minutes by default (`RATE_LIMIT_MAX`). On Vercel each server instance counts separately, so this is a best-effort guard. For a hard limit, also turn on rate limiting in Vercel's **Firewall**.
- **No migration needed.** The database table is upgraded automatically on first use.
- **Be honest with your users.** The pasted text is sent to the AI provider you configure (Google, Groq or OpenAI) for analysis. Add a short privacy note on your site if you share it publicly.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm run dev` says port 3000 is busy | `npm run dev -- -p 3001` |
| History says "memory only" | SQLite could not load. Set a Postgres `DATABASE_URL` (Part 2) |
| Yellow "PostgreSQL unavailable" note | Re-copy the connection string; Neon needs `?sslmode=require` |
| AI error: "openai returned 401" with a Google key | Old version of the project: it did not recognise `AQ.` keys. Re-download the latest zip, or set `AI_PROVIDER=gemini` |
| AI error: 401 | The key is wrong or has extra spaces/quotes in `.env.local` |
| AI error: 404 / model not found | The model was retired. Update to this README's version of the project, or set `AI_MODEL` to a model from your provider's current list |
| AI error: 429 | Free-tier rate limit. Wait a minute or switch provider |
| Changes to `.env.local` ignored | Stop and restart `npm run dev` |
| `prisma generate` fails with `CLI.UNKNOWN_COMMAND` | A Prisma 8 CLI was picked up. This project pins Prisma 6.19.3 and ships a `package-lock.json`. Delete `node_modules`, then run `npm install` again |
| `npm audit` reports warnings about Prisma CLI, Tailwind or PostCSS | These are build-time tools that never run on your server. Do not run `npm audit fix --force`, it upgrades to versions this project is not written for |
| GitHub blocks the push with "Push cannot contain secrets" | A real key is in a committed file (usually `.env.example`). Revoke that key, empty the value in `.env.example`, delete the `.git` folder, then run `git init` and the Part 4 commands again |
| Vercel build fails on Prisma | Check `DATABASE_URL` is set for the Production environment and redeploy |
