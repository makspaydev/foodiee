#!/usr/bin/env node
/*
 * Tag every recipe's ingredients with a canonical, categorized grocery item —
 * the foundation for pantry matching ("what can I cook with what I have?").
 *
 * Two passes via Gemini:
 *   1) Per-recipe: map each ingredient line -> { canon, category, staple }.
 *   2) Consolidate: merge synonyms across all recipes into one clean vocabulary
 *      (curd/dahi -> yogurt, bell pepper -> capsicum, cilantro -> coriander…).
 *
 * Output: src/pantryData.js
 *   - RECIPE_INGREDIENTS: { [recipeId]: [{ raw, canon, category, staple }] }
 *   - PANTRY:             { [category]: [canon, …] }   (staples excluded, deduped)
 *   - STAPLES:            [ "salt", "water", … ]        (assumed always on hand)
 *
 * Resumable: per-recipe results are cached to scripts/.ingredient-cache.json.
 * Usage:  node scripts/tag-ingredients.mjs           (all recipes)
 *         FORCE=1 node scripts/tag-ingredients.mjs   (ignore cache, redo)
 */
import { writeFile, readFile } from 'node:fs/promises'
import { recipes } from '../src/recipes.js'

const ROOT = new URL('../', import.meta.url)
const OUT = new URL('src/pantryData.js', ROOT)
const CACHE = new URL('scripts/.ingredient-cache.json', ROOT)

// --- load GEMINI_API_KEY from env or .env.local / .env ---
for (const name of ['.env.local', '.env']) {
  try {
    const txt = await readFile(new URL(name, ROOT), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* file may not exist */
  }
}
const KEY = process.env.GEMINI_API_KEY
if (!KEY) {
  console.error('✗ No GEMINI_API_KEY (env or .env.local).')
  process.exit(1)
}
const MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'
const URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

// Fixed taxonomy so categories stay consistent and the pantry UI is predictable.
const CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Herbs & aromatics',
  'Dairy & eggs',
  'Paneer & proteins',
  'Flours & grains',
  'Lentils & pulses',
  'Spices & masalas',
  'Oils & fats',
  'Condiments & sauces',
  'Nuts & seeds',
  'Sweeteners',
  'Baking & other',
]
// Always-on-hand items: never shown in the pantry, never counted as a gap.
const STAPLES = ['salt', 'water', 'oil', 'sugar', 'black pepper']
// Equipment / non-grocery lines that slip through tagging — dropped from the
// pantry entirely (you don't shop for these on Instamart).
const EXCLUDE = new Set([
  'skewer', 'skewers', 'silicone muffin cup', 'muffin cup', 'toothpick',
  'parchment paper', 'aluminium foil', 'foil', 'baking tray', 'tongs',
])

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function gemini(prompt, schema) {
  let attempt = 0
  while (true) {
    try {
      const res = await fetch(URL_BASE, {
        method: 'POST',
        headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.1,
          },
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`)
      const data = await res.json()
      const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
      return JSON.parse(text)
    } catch (err) {
      attempt++
      if (attempt < 4 && /HTTP (429|5\d\d)|fetch failed|timeout/i.test(err.message)) {
        await sleep(2000 * attempt)
        continue
      }
      throw err
    }
  }
}

// ---- Pass 1: per-recipe ingredient tagging (batched) ----
const BATCH_SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                raw: { type: 'string' },
                canon: { type: 'string' },
                category: { type: 'string', enum: CATEGORIES },
                staple: { type: 'boolean' },
              },
              required: ['raw', 'canon', 'category', 'staple'],
            },
          },
        },
        required: ['id', 'items'],
      },
    },
  },
  required: ['recipes'],
}

function batchPrompt(batch) {
  return (
    'For each recipe below, map EVERY ingredient line to a canonical grocery item.\n' +
    'Rules:\n' +
    '- Output exactly one item per ingredient line, preserving the original line in "raw".\n' +
    '- "canon": the simplest common Indian-grocery name, lowercase & singular — the thing you would buy.\n' +
    "  Examples: '1 tbsp besan (gram flour)' -> 'besan'; '250 g paneer, cubed' -> 'paneer';\n" +
    "  '4 tbsp thick yogurt' -> 'yogurt'; '2 cloves garlic, minced' -> 'garlic'.\n" +
    '  If a line lists two items (e.g. "1 capsicum + 1 onion"), pick the main one.\n' +
    `- "category": one of: ${CATEGORIES.join(', ')}.\n` +
    '- "staple": true ONLY for salt, water, plain cooking oil, sugar, black pepper.\n\n' +
    'RECIPES:\n' +
    JSON.stringify(batch.map((r) => ({ id: r.id, ingredients: r.ingredients })))
  )
}

// ---- Pass 2: consolidate synonyms into one canonical vocabulary ----
const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    mappings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
        },
        required: ['from', 'to', 'category'],
      },
    },
  },
  required: ['mappings'],
}

function mergePrompt(names) {
  return (
    'These ingredient names were extracted from many recipes. Merge duplicates and ' +
    'synonyms into ONE canonical grocery name each.\n' +
    'Examples: curd, dahi -> yogurt; bell pepper -> capsicum; cilantro, coriander leaves -> coriander; ' +
    'scallion -> spring onion; clarified butter -> ghee.\n' +
    'For every input name return { from, to (canonical, lowercase singular), category }.\n' +
    `Category must be one of: ${CATEGORIES.join(', ')}.\n\n` +
    'NAMES:\n' +
    JSON.stringify(names)
  )
}

// --- run ---
const force = process.env.FORCE === '1'
let cache = {}
if (!force) {
  try {
    cache = JSON.parse(await readFile(CACHE, 'utf8'))
  } catch {
    /* no cache yet */
  }
}

const todo = recipes.filter((r) => !cache[r.id])
console.log(
  `Tagging ${todo.length} recipe(s)` +
    (recipes.length - todo.length ? ` (${recipes.length - todo.length} cached)` : '') +
    `…`,
)

const BATCH = 8
for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH)
  try {
    const out = await gemini(batchPrompt(batch), BATCH_SCHEMA)
    for (const r of out.recipes || []) cache[r.id] = r.items
    await writeFile(CACHE, JSON.stringify(cache))
    console.log(`  ✓ ${Math.min(i + BATCH, todo.length)}/${todo.length}`)
  } catch (err) {
    console.error(`  ✗ batch ${i}: ${err.message}`)
  }
  await sleep(800)
}

// Collect unique canon names (non-staple, non-equipment) for consolidation.
const isStaple = (it) => it.staple || STAPLES.includes(it.canon?.toLowerCase().trim())
const rawNames = new Set()
for (const items of Object.values(cache)) {
  for (const it of items) {
    const c = (it.canon || '').toLowerCase().trim()
    if (c && !isStaple(it) && !EXCLUDE.has(c)) rawNames.add(c)
  }
}
console.log(`\nConsolidating ${rawNames.size} unique ingredient names…`)

const alias = {} // from -> to
const catOf = {} // canonical -> category
try {
  const merged = await gemini(mergePrompt([...rawNames].sort()), MERGE_SCHEMA)
  for (const m of merged.mappings || []) {
    const from = (m.from || '').toLowerCase().trim()
    const to = (m.to || '').toLowerCase().trim()
    if (from && to) {
      alias[from] = to
      if (CATEGORIES.includes(m.category)) catOf[to] = m.category
    }
  }
} catch (err) {
  console.error(`  ✗ consolidation failed (${err.message}); using raw canon names.`)
}

const canonical = (c) => alias[c] || c

// Build final per-recipe tags + the pantry (canonical, by category, deduped).
const RECIPE_INGREDIENTS = {}
const pantrySets = {}
for (const [id, items] of Object.entries(cache)) {
  RECIPE_INGREDIENTS[id] = items.map((it) => {
    const c = (it.canon || '').toLowerCase().trim()
    // Equipment is treated like a staple: ignored in matching, kept out of the pantry.
    const staple = isStaple(it) || EXCLUDE.has(c)
    const canon = staple ? c : canonical(c)
    const category = catOf[canon] || it.category
    return { raw: it.raw, canon, category, staple }
  })
  for (const it of RECIPE_INGREDIENTS[id]) {
    if (it.staple) continue
    ;(pantrySets[it.category] ||= new Set()).add(it.canon)
  }
}

const PANTRY = {}
for (const cat of CATEGORIES) {
  if (pantrySets[cat]?.size) PANTRY[cat] = [...pantrySets[cat]].sort()
}

const banner =
  '// Auto-generated by scripts/tag-ingredients.mjs — canonical ingredient tags\n' +
  '// for pantry matching. Do not edit by hand; re-run the script.\n\n'
await writeFile(
  OUT,
  banner +
    `export const STAPLES = ${JSON.stringify(STAPLES)}\n\n` +
    `export const PANTRY = ${JSON.stringify(PANTRY, null, 2)}\n\n` +
    `export const RECIPE_INGREDIENTS = ${JSON.stringify(RECIPE_INGREDIENTS, null, 2)}\n`,
)

const totalItems = Object.keys(PANTRY).reduce((n, c) => n + PANTRY[c].length, 0)
console.log(
  `\n✓ Wrote src/pantryData.js — ${Object.keys(RECIPE_INGREDIENTS).length} recipes, ` +
    `${totalItems} pantry items across ${Object.keys(PANTRY).length} categories.`,
)
