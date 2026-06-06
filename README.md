# 🍳 Foodiee

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

## Adding recipes

All recipes live in [`src/recipes.js`](src/recipes.js). Copy an existing entry
and edit the fields:

- `appliance` — `'airfryer'` or `'steamer'`
- `meals` — any of `'breakfast'`, `'lunch'`, `'dinner'`
- `setting` — the dial / time to use on that appliance
- `tags` — free-form labels; new tags automatically appear in the filter bar

No other files need to change.
