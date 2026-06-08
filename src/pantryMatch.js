// Pantry matching: given the canonical ingredients a user has, score how close
// each recipe is to cookable. Pure set intersection over the tags from phase 1.
import { RECIPE_INGREDIENTS } from './pantryData.js'

// Unique, non-staple canonical ingredients a recipe needs. Built-in recipes use
// the generated tags; imported recipes can carry their own `canonTags` later.
function requiredTags(recipe) {
  const tags = RECIPE_INGREDIENTS[recipe.id] || recipe.canonTags || []
  const seen = new Map()
  for (const t of tags) {
    if (t.staple) continue
    if (!seen.has(t.canon)) seen.set(t.canon, t)
  }
  return [...seen.values()]
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
