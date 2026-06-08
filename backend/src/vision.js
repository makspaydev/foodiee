// Screenshot(s) → recipe via Gemini Vision. Same recipe shape as reel.js so the
// frontend renders it identically. Accepts one or more images (base64) — a user
// can snap the ingredient frame + the steps frame and we read across all of them.
import fs from 'node:fs'
import { normCanonLines } from './reel.js'

const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash'
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert']
const APPLIANCE_KEYS = ['airfryer', 'steamer', 'mixer', 'oven', 'cooktop', 'pressurecooker']
const PALETTE = [
  '#ffd166', '#ef8354', '#a0c4ff', '#bdb2ff',
  '#caffbf', '#ffc6ff', '#fdffb6', '#9bf6ff', '#ffadad', '#ffd6a5',
]

function hashId(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return 'shot-' + h.toString(36)
}

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    isRecipe: { type: 'boolean' },
    hasIngredients: { type: 'boolean' },
    title: { type: 'string' },
    cuisine: { type: 'string' },
    appliance: { type: 'string', enum: APPLIANCE_KEYS },
    equipment: { type: 'array', items: { type: 'string', enum: APPLIANCE_KEYS } },
    meals: { type: 'array', items: { type: 'string', enum: MEAL_KEYS } },
    time: { type: 'integer' },
    difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
    servings: { type: 'string' },
    emoji: { type: 'string' },
    setting: { type: 'string' },
    ingredients: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
    canonLines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          raw: { type: 'string' },
          canon: { type: 'string' },
          staple: { type: 'boolean' },
        },
        required: ['raw', 'canon', 'staple'],
      },
    },
  },
  required: ['isRecipe', 'hasIngredients', 'title', 'ingredients', 'steps'],
}

const CANON_INSTRUCTION =
  '- Also output "canonLines": for EACH ingredient line, an object ' +
  '{ raw (the line), canon (its main grocery item, lowercase singular common name — ' +
  'yogurt not curd, capsicum not bell pepper), staple (true ONLY for salt, water, oil, sugar, pepper) }.\n'

const clamp = (v, allowed, fb) => (allowed.includes(v) ? v : fb)

function normalize(parsed, idSeed) {
  const id = hashId(idSeed)
  const meals = Array.isArray(parsed.meals)
    ? [...new Set(parsed.meals.filter((m) => MEAL_KEYS.includes(m)))]
    : []
  const ingredients = (parsed.ingredients || []).map((s) => String(s).trim()).filter(Boolean)
  const steps = (parsed.steps || []).map((s) => String(s).trim()).filter(Boolean)
  const tags = (parsed.tags || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean)
  if (!tags.includes('from-reel')) tags.unshift('from-reel')
  const color = PALETTE[Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETTE.length]
  return {
    id,
    isRecipe: parsed.isRecipe !== false,
    hasIngredients: !!parsed.hasIngredients && ingredients.length > 0,
    title: String(parsed.title || 'Imported recipe').trim(),
    emoji: (parsed.emoji || '🍽').trim() || '🍽',
    color,
    meals: meals.length ? meals : ['dinner'],
    appliance: clamp(parsed.appliance, APPLIANCE_KEYS, 'cooktop'),
    equipment: Array.isArray(parsed.equipment)
      ? [...new Set(parsed.equipment.filter((e) => APPLIANCE_KEYS.includes(e)))]
          .filter((e) => e !== clamp(parsed.appliance, APPLIANCE_KEYS, 'cooktop'))
      : [],
    cuisine: String(parsed.cuisine || 'Global').trim(),
    time: Number.isFinite(parsed.time) ? parsed.time : 20,
    difficulty: clamp(parsed.difficulty, ['Easy', 'Medium', 'Hard'], 'Easy'),
    servings: String(parsed.servings || '2').trim(),
    setting: String(parsed.setting || '').trim(),
    ingredients,
    steps,
    tags,
    note: String(parsed.note || '').trim(),
    canonLines: normCanonLines(parsed),
    source: 'screenshot',
  }
}

// images: array of { data: <base64>, mimeType: 'image/png'|'image/jpeg' }
export async function recipeFromImages(images, idSeed = 'shot') {
  if (!GEMINI_KEY) throw new Error('gemini_not_configured')
  if (!images?.length) throw new Error('no_images')
  const prompt =
    'You are a culinary assistant for Foodiee, a recipe app.\n' +
    'These image(s) are screenshots from a cooking reel. Read ALL on-screen text and the dish itself.\n' +
    '- Extract a single recipe ONLY from what is actually shown/written. Do NOT invent ingredients or quantities that are not visible.\n' +
    '- Set hasIngredients=true only if an actual ingredient list (with items/quantities) is visible in the images.\n' +
    '- If only the finished dish or a title is shown (no ingredient list), set hasIngredients=false, still identify the dish title, and put a short explanation in "note" (e.g. "Only the finished dish is shown — no ingredient list in these frames").\n' +
    '- If it is not food at all, set isRecipe=false.\n' +
    '- Pick the PRIMARY appliance the dish is cooked on, from exactly: airfryer, steamer, mixer, oven, cooktop (stovetop/induction/kadai/tawa/pan), pressurecooker. In "equipment" list any OTHER appliances from that set also needed (omit the primary).\n' +
    '- Write ingredient lines as "quantity + item" for grocery shopping; pick one food emoji.\n' +
    '- Write a CONCISE method of about 5 numbered steps (4-6 max) — combine related actions into one step, like a tight recipe card. Do not over-split.\n' +
    CANON_INSTRUCTION
  const parts = [{ text: prompt }]
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mimeType || 'image/png', data: img.data } })
  }
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RECIPE_SCHEMA,
      temperature: 0.3,
    },
  }
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!r.ok) throw new Error('gemini_failed_' + r.status)
  const data = await r.json()
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('gemini_bad_json')
  }
  return normalize(parsed, idSeed)
}

// Generate a standard, well-known recipe for a recognized dish name (used when a
// screenshot shows the finished dish but no ingredient list). For Foodiee's goal
// — cook the dish + order the groceries — a standard ingredient list is exactly
// what the user needs.
export async function recipeFromDish(dish, idSeed = dish) {
  if (!GEMINI_KEY) throw new Error('gemini_not_configured')
  const prompt =
    'You are a culinary assistant for Foodiee, a recipe app.\n' +
    `Generate a single, standard, well-known recipe for "${dish}".\n` +
    '- Provide a realistic ingredient list as "quantity + item" lines suitable for grocery shopping.\n' +
    '- Write a CONCISE method of about 5 numbered steps (4-6 max) — combine related actions into one step, like a tight recipe card. Do not over-split.\n' +
    '- Pick the PRIMARY appliance from exactly: airfryer, steamer, mixer, oven, cooktop (stovetop/induction/kadai/tawa/pan), pressurecooker. In "equipment" list any OTHER appliances from that set also needed (omit the primary).\n' +
    '- Pick one fitting food emoji. Set isRecipe=true and hasIngredients=true.\n' +
    CANON_INSTRUCTION
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RECIPE_SCHEMA,
      temperature: 0.5,
    },
  }
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!r.ok) throw new Error('gemini_failed_' + r.status)
  const data = await r.json()
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('gemini_bad_json')
  }
  const recipe = normalize(parsed, idSeed)
  return { ...recipe, source: 'generated', generated: true }
}

// Generate an AI food photo for a recipe (same style as the built-in catalog,
// see scripts/generate-images.mjs). Returns raw base64 + mime; the client
// downscales/compresses before storing.
export async function generateRecipeImage(title, cuisine = '') {
  if (!GEMINI_KEY) throw new Error('gemini_not_configured')
  const prompt =
    `Professional overhead food photography of "${title}"` +
    (cuisine ? `, ${cuisine} cuisine` : '') +
    '. Beautifully plated and garnished on a clean light neutral background, soft natural ' +
    'lighting, shallow depth of field, fresh and appetising, realistic, high detail. ' +
    'No text, no labels, no hands, no people.'
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    },
  )
  if (!r.ok) throw new Error('image_failed_' + r.status)
  const data = await r.json()
  const part = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)
  if (!part) throw new Error('no_image')
  return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' }
}

// CLI test: node src/vision.js <image1> [image2 …]
if (process.argv[1] && process.argv[1].endsWith('vision.js')) {
  const files = process.argv.slice(2)
  if (!files.length) {
    console.error('usage: node src/vision.js <image> [more images…]')
    process.exit(1)
  }
  const images = files.map((f) => ({
    data: fs.readFileSync(f).toString('base64'),
    mimeType: f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg')
      ? 'image/jpeg'
      : 'image/png',
  }))
  const recipe = await recipeFromImages(images, files[0])
  console.log(JSON.stringify(recipe, null, 2))
}
