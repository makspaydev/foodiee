// Reel → recipe: pull an Instagram caption from the public page and turn it into
// a Foodiee-shaped recipe via Gemini. No Swiggy auth needed for this step — it's
// independent of the ordering flow (which still requires the user's own token).
const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'

const IG_RE = /^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[\w-]+/i

// Warm, food-y card backgrounds (match the existing recipe palette vibe).
const PALETTE = [
  '#ffd166', '#ef8354', '#a0c4ff', '#bdb2ff',
  '#caffbf', '#ffc6ff', '#fdffb6', '#9bf6ff', '#ffadad', '#ffd6a5',
]

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert']
const APPLIANCE_KEYS = ['airfryer', 'steamer']

export function isInstagramUrl(url) {
  return IG_RE.test(String(url || ''))
}

// Small stable hash so the same reel always maps to the same recipe id.
function hashId(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return 'reel-' + h.toString(36)
}

function decodeEntities(s = '') {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16)))
}

// Best-effort caption fetch from the public reel page's OpenGraph tags.
// Instagram exposes the caption in <meta property="og:description"> for public
// posts; this avoids any private API and works server-side (no CORS).
export async function fetchInstagramCaption(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`instagram_fetch_failed_${res.status}`)
  const html = await res.text()
  const meta = (prop) => {
    const m =
      html.match(
        new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'),
      ) ||
      html.match(
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${prop}["']`, 'i'),
      )
    return m ? decodeEntities(m[1]) : ''
  }
  const caption = [meta('og:title'), meta('og:description')].filter(Boolean).join('\n').trim()
  const image = meta('og:image')
  return { caption, image }
}

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    isRecipe: { type: 'boolean' },
    title: { type: 'string' },
    cuisine: { type: 'string' },
    appliance: { type: 'string', enum: APPLIANCE_KEYS },
    meals: { type: 'array', items: { type: 'string', enum: MEAL_KEYS } },
    time: { type: 'integer' },
    difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
    servings: { type: 'string' },
    emoji: { type: 'string' },
    setting: { type: 'string' },
    ingredients: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['isRecipe', 'title', 'appliance', 'meals', 'ingredients', 'steps'],
}

function clampOne(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

// Coerce Gemini's output into a fully-formed recipe the React app can render
// without crashing (every field RecipeModal/RecipeCard touches is guaranteed).
function normalize(parsed, sourceUrl) {
  const id = hashId(sourceUrl)
  const meals = Array.isArray(parsed.meals)
    ? [...new Set(parsed.meals.filter((m) => MEAL_KEYS.includes(m)))]
    : []
  const ingredients = (parsed.ingredients || []).map((s) => String(s).trim()).filter(Boolean)
  const steps = (parsed.steps || []).map((s) => String(s).trim()).filter(Boolean)
  const tags = (parsed.tags || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean)
  if (!tags.includes('from-reel')) tags.unshift('from-reel')
  // Stable colour pick from the id so the same reel keeps the same look.
  const color = PALETTE[Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETTE.length]
  return {
    id,
    isRecipe: parsed.isRecipe !== false,
    title: String(parsed.title || 'Imported recipe').trim(),
    emoji: (parsed.emoji || '🍽').trim() || '🍽',
    color,
    meals: meals.length ? meals : ['dinner'],
    appliance: clampOne(parsed.appliance, APPLIANCE_KEYS, 'airfryer'),
    cuisine: String(parsed.cuisine || 'Global').trim(),
    time: Number.isFinite(parsed.time) ? parsed.time : 20,
    difficulty: clampOne(parsed.difficulty, ['Easy', 'Medium', 'Hard'], 'Easy'),
    servings: String(parsed.servings || '2').trim(),
    setting: String(parsed.setting || '').trim(),
    ingredients,
    steps,
    tags,
    source: 'reel',
    sourceUrl,
  }
}

export async function recipeFromCaption(caption, sourceUrl) {
  if (!GEMINI_KEY) throw new Error('gemini_not_configured')
  const prompt =
    'You are a culinary assistant for Foodiee, an app focused on AIR FRYER and STEAMER cooking.\n' +
    'From the Instagram caption below, extract a single structured recipe.\n' +
    '- Adapt the cooking method to an air fryer or a steamer where reasonable, and pick the closest "appliance".\n' +
    '- Write clean ingredient lines as "quantity + item" (e.g. "250 g paneer, cubed") suitable for grocery shopping.\n' +
    '- Write clear numbered method steps.\n' +
    '- Pick a single fitting food emoji.\n' +
    '- If the caption is NOT a cooking recipe, set isRecipe to false and leave the other fields minimal.\n\n' +
    'CAPTION:\n' +
    caption
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RECIPE_SCHEMA,
      temperature: 0.4,
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
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('gemini_bad_json')
  }
  return normalize(parsed, sourceUrl)
}
