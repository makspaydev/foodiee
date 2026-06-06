# 🍳 Foodiee

**Live:** https://makspaydev.github.io/foodiee/

An internal recipe site for our two kitchen gadgets:

- **Philips Airfryer** (RapidAir) — air-fryer recipes, temperatures in °C
- **Wipro Multi Cooker / Egg Boiler** — multi-tier steamer recipes, times in minutes

Browse recipes by **meal** (breakfast / lunch / dinner), by **appliance**, or by
dietary **tags**, and search by name or ingredient. Click any card for the full
ingredient list, method, and the exact appliance setting to use.

## Run it locally

```bash
npm install
npm run dev
```

This starts the Vite dev server and opens the site (default
[http://localhost:5173](http://localhost:5173)).

## Build for sharing

```bash
npm run build      # outputs a static site to dist/
npm run preview    # preview the production build locally
```

The `dist/` folder is a fully static site — drop it on any internal file share,
intranet, or static host.

## Deployment

The site auto-deploys to **GitHub Pages** on every push to `main` via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Just commit and
push — the workflow builds and publishes within ~1 minute.

Because Pages serves project sites from `/foodiee/`, the production build sets
that base path automatically (see [`vite.config.js`](vite.config.js)); local dev
still runs at root.

## Adding recipes

All recipes live in [`src/recipes.js`](src/recipes.js). Copy an existing entry
and edit the fields:

- `appliance` — `'airfryer'` or `'steamer'`
- `meals` — any of `'breakfast'`, `'lunch'`, `'dinner'`
- `setting` — the dial / time to use on that appliance
- `tags` — free-form labels; new tags automatically appear in the filter bar

No other files need to change.
