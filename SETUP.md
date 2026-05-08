# Chancellor Institute — Research Compass
## Setup Guide (3 steps, ~20 minutes)

---

### What's in this folder

```
research-compass-vercel/
├── api/
│   └── generate.js     ← Runs on Vercel's servers (your API key lives here, never in the browser)
├── public/
│   └── index.html      ← The page your visitors see
├── vercel.json         ← Tells Vercel how to connect the two files above
└── SETUP.md            ← This guide
```

---

### What's protected

| Threat | Protection |
|---|---|
| API key theft | Key lives only on the server, never in the browser |
| Excessive use by one visitor | Rate limit: 5 generations per visitor per hour |
| Prompt injection via the form | Sector validated server-side against a fixed whitelist |
| Unexpected bill spike | Set a spending cap in Google AI Studio (see Step 3) |

---

## Step 1 — Get your free Gemini API key (2 minutes)

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with any Google account
3. Click **Create API key**
4. Copy the key — it looks like `AIzaSyXXXXXXXXXXXXXXX`

Keep this somewhere safe. You'll paste it into Vercel in Step 3.

---

## Step 2 — Put the files on GitHub (5 minutes)

Vercel reads your files from GitHub.

1. Go to **https://github.com** and sign in (or create a free account)
2. Click **+** → **New repository**
3. Name it `research-compass` and click **Create repository**
4. On the next screen, click **uploading an existing file**
5. Drag and drop **all the files and folders** from this `research-compass-vercel` folder
6. Click **Commit changes**

---

## Step 3 — Deploy on Vercel (10 minutes)

1. Go to **https://vercel.com** and sign up using your GitHub account
2. Click **Add New → Project**
3. Find and select your `research-compass` repository → click **Import**
4. Click **Environment Variables** and add one variable:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** paste your API key from Step 1
5. Click **Deploy**

Vercel will give you a live URL like `research-compass.vercel.app`. That's your page — done.

---

## Step 4 — Set a spending cap (recommended, 2 minutes)

As a safety net, set a monthly limit in Google AI Studio so you can never be surprised by an unexpected bill:

1. Go to **https://aistudio.google.com**
2. Go to **Billing** or **Usage limits**
3. Set a monthly cap of **$5**

At the Research Compass's usage level (each generation costs roughly $0.001), $5 would cover approximately 5,000 generations — far more than any realistic monthly traffic for a PhD recruitment tool.

---

## How it works for visitors

1. Visitor selects a sector and optional keywords, then clicks "Find research directions"
2. The page sends the request to `/api/generate` — your Vercel function
3. The function validates the sector, applies rate limiting, adds your secret API key, and calls Google's Gemini AI
4. Five original leadership PhD thesis ideas come back and animate into view
5. The visitor can add keywords and regenerate for a fresh set

**Your API key is never visible to visitors** — it exists only inside the Vercel function on the server.

---

## Your live page

Once deployed, share the Vercel URL with prospective PhD students.

You can also connect a custom domain (e.g. `research.chancellor.education`) under **Project Settings → Domains** in Vercel — this takes about 5 minutes and makes the tool feel like part of your website.

---

## Files summary

```
api/generate.js    — Server function: validates input, rate limits, calls Gemini
public/index.html  — The Research Compass page visitors see
vercel.json        — Routing: connects the page to the function
SETUP.md           — This guide
```
