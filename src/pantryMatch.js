// Pantry matching: given the canonical ingredients a user has, score how close
// each recipe is to cookable. Pure set intersection over the tags from phase 1.
import { RECIPE_INGREDIENTS } from './pantryData.js'

// Per-ingredient-line canonical tags. Built-in recipes use the generated tags;
// imported recipes carry their own `canonLines` from the backend.
function recipeLines(recipe) {
  return RECIPE_INGREDIENTS[recipe.id] || recipe.canonLines || []
}

// Unique, non-staple canonical ingredients a recipe needs.
function requiredTags(recipe) {
  const seen = new Map()
  for (const t of recipeLines(recipe)) {
    if (t.staple) continue
    if (t.canon && !seen.has(t.canon)) seen.set(t.canon, t)
  }
  return [...seen.values()]
}

// Shopping-list keys (lowercased raw lines) for ingredients the user already has
// — staples, plus pantry items. These get auto-ticked so the Instamart cart is
// only the gap. Compound lines ("1 capsicum + 1 onion", "1 tsp each: …") are left
// unticked even if their main item matches, so we never drop a hidden ingredient.
export function coveredLineKeys(recipe, pantry) {
  return recipeLines(recipe)
    .filter((l) => {
      if (l.staple) return true
      if (!l.canon || !pantry.has(l.canon)) return false
      if (/[+]|:\s/.test(l.raw || '')) return false
      return true
    })
    .map((l) => (l.raw || '').trim().toLowerCase())
    .filter(Boolean)
}

// Does this recipe have pantry tags at all (built-in or imported)?
export function hasPantryTags(recipe) {
  return recipeLines(recipe).length > 0
}

export function matchRecipe(recipe, pantry) {
  const req = requiredTags(recipe)
  if (!req.length) return null
  const have = []
  const missing = []
  for (const t of req) (pantry.has(t.canon) ? have : missing).push(t)
  return {
    recipe,
    total: req.length,
    have,
    missing,
    haveCount: have.length,
    missingCount: missing.length,
    coverage: have.length / req.length,
  }
}

// All recipes scored, closest-to-cookable first.
export function matchAll(recipeList, pantry) {
  return recipeList
    .map((r) => matchRecipe(r, pantry))
    .filter(Boolean)
    .sort((a, b) => a.missingCount - b.missingCount || b.haveCount - a.haveCount)
}
