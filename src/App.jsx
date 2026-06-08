import { useMemo, useState, useEffect } from 'react'
import { recipes, MEALS, APPLIANCES, ALL_TAGS } from './recipes.js'
import RecipeModal from './RecipeModal.jsx'
import ShoppingList from './ShoppingList.jsx'
import HowItWorks from './HowItWorks.jsx'
import ImportRecipe, { extractInstagramUrl } from './ImportRecipe.jsx'
import Pantry from './Pantry.jsx'
import { ORDERING_ENABLED, recipeImage } from './backend.js'
import { compressDataUrl } from './imageUtil.js'
import { IMAGES } from './imageManifest.js'
import { AFFILIATE_ENABLED, buyUrl, productName, DISCLOSURE } from './affiliate.js'
import { track } from './analytics.js'

// Path to an image file (served from public/images). Base-path safe.
export const imageSrc = (file) => `${import.meta.env.BASE_URL}images/${file}`

const FAV_KEY = 'foodiee:favorites'
const LIST_KEY = 'foodiee:list'
const CHECKED_KEY = 'foodiee:checked'
const IMPORTED_KEY = 'foodiee:imported'
const PANTRY_KEY = 'foodiee:pantry'

// Pre-filled email for the "Suggest a recipe" links.
const SUGGEST_MAILTO =
  'mailto:shiva@foodiee.live?subject=' +
  encodeURIComponent('Recipe suggestion for Foodiee 🍳') +
  '&body=' +
  encodeURIComponent("I'd love to see this recipe on Foodiee:\n\n")

// Pick a random recipe matching a meal from a candidate list.
function pickRandom(list, meal) {
  const pool = list.filter((r) => r.meals.includes(meal))
  if (!pool.length) return null
  // Index-based pseudo-pick avoids needing Math.random in restricted contexts,
  // but in the browser Math.random is available, so use it for real variety.
  return pool[Math.floor(Math.random() * pool.length)]
}

export default function App() {
  const [meal, setMeal] = useState('all') // 'all' | 'breakfast' | 'lunch' | 'dinner'
  const [appliance, setAppliance] = useState('all') // 'all' | 'airfryer' | 'steamer'
  const [activeTags, setActiveTags] = useState([]) // dietary / misc tags
  const [query, setQuery] = useState('')
  const [favsOnly, setFavsOnly] = useState(false)
  const [selected, setSelected] = useState(null) // recipe shown in modal
  const [plan, setPlan] = useState(null) // { breakfast, lunch, dinner }
  const [showList, setShowList] = useState(false) // shopping list open?
  const [showHelp, setShowHelp] = useState(false) // "how it works" open?
  const [showPantry, setShowPantry] = useState(false) // pantry screen open?
  const [importState, setImportState] = useState(null) // { url, fromShare } | null

  // Favorites, persisted to localStorage.
  const [favorites, setFavorites] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'))
    } catch {
      return new Set()
    }
  })

  // Recipes whose ingredients are on the shopping list — independent of favorites.
  const [onList, setOnList] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(LIST_KEY) || '[]'))
    } catch {
      return new Set()
    }
  })

  // Checked-off shopping items, persisted to localStorage.
  const [checked, setChecked] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CHECKED_KEY) || '[]'))
    } catch {
      return new Set()
    }
  })

  // Recipes imported from Instagram reels, persisted to localStorage so they
  // survive reloads and remain shareable/orderable like built-in recipes.
  const [importedRecipes, setImportedRecipes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(IMPORTED_KEY) || '[]')
    } catch {
      return []
    }
  })

  // Pantry: canonical ingredient names the user has on hand, persisted.
  const [pantry, setPantry] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(PANTRY_KEY) || '[]'))
    } catch {
      return new Set()
    }
  })

  // Built-in catalog + anything the user imported (imported first so it's easy to find).
  const allRecipes = useMemo(() => [...importedRecipes, ...recipes], [importedRecipes])

  // Appliance chips only show for appliances that actually have recipes, so the
  // four "expansion" appliances appear only once an imported recipe uses them.
  const availableAppliances = useMemo(
    () => new Set(allRecipes.map((r) => r.appliance)),
    [allRecipes],
  )

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem(LIST_KEY, JSON.stringify([...onList]))
  }, [onList])

  useEffect(() => {
    localStorage.setItem(CHECKED_KEY, JSON.stringify([...checked]))
  }, [checked])

  useEffect(() => {
    try {
      localStorage.setItem(IMPORTED_KEY, JSON.stringify(importedRecipes))
    } catch {
      /* storage full (e.g. many recipe images) — keep them in memory for this session */
    }
  }, [importedRecipes])

  useEffect(() => {
    localStorage.setItem(PANTRY_KEY, JSON.stringify([...pantry]))
  }, [pantry])

  const togglePantryItem = (canon) =>
    setPantry((prev) => {
      const next = new Set(prev)
      next.has(canon) ? next.delete(canon) : next.add(canon)
      return next
    })

  // Toggle a whole category: if everything's selected, clear it; else select all.
  const togglePantryCategory = (catItems) =>
    setPantry((prev) => {
      const next = new Set(prev)
      const allSelected = catItems.every((i) => next.has(i))
      catItems.forEach((i) => (allSelected ? next.delete(i) : next.add(i)))
      return next
    })

  // Generate an AI food photo for an imported recipe in the background, then
  // slot it into the card + modal (progressive — the recipe is usable instantly).
  const attachRecipeImage = async (recipe) => {
    if (!ORDERING_ENABLED || recipe.image) return
    try {
      const { data, mimeType } = await recipeImage(recipe)
      const image = await compressDataUrl(`data:${mimeType};base64,${data}`)
      setImportedRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, image } : r)))
      setSelected((sel) => (sel && sel.id === recipe.id ? { ...sel, image } : sel))
    } catch {
      /* leave the emoji hero in place */
    }
  }

  // Open a recipe from a shared link (?recipe=<id>) on first load.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('recipe')
    if (id) {
      const r = allRecipes.find((x) => x.id === id)
      if (r) setSelected(r)
    }
    // allRecipes is read once on mount; imported recipes are already hydrated
    // from localStorage by then, so a ?recipe=reel-… deep link resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle a reel shared into Foodiee via the PWA Web Share Target (Android).
  // The manifest maps the OS share fields onto ?sharetitle/?sharetext/?shareurl,
  // so on first load we pull any Instagram link out, open the import screen, and
  // scrub the params so a refresh doesn't re-trigger it.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const blob = [p.get('shareurl'), p.get('sharetext'), p.get('sharetitle')]
      .filter(Boolean)
      .join(' ')
    if (!blob) return
    const url = extractInstagramUrl(blob)
    setImportState({ url, fromShare: true })
    track('reel_share_received', { had_url: !!url })
    const clean = new URL(window.location.href)
    ;['sharetitle', 'sharetext', 'shareurl'].forEach((k) => clean.searchParams.delete(k))
    window.history.replaceState({}, '', clean)
  }, [])

  // Keep the URL in sync with the open recipe so it's always shareable.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (selected) url.searchParams.set('recipe', selected.id)
    else url.searchParams.delete('recipe')
    window.history.replaceState({}, '', url)
  }, [selected])

  const toggleList = (id) => {
    const adding = !onList.has(id)
    setOnList((prev) => {
      const next = new Set(prev)
      adding ? next.add(id) : next.delete(id)
      return next
    })
    if (adding) track('add_to_list', { recipe_id: id })
  }

  // Open a recipe and record it in analytics.
  const openRecipe = (r) => {
    setSelected(r)
    track('recipe_open', {
      recipe_id: r.id,
      recipe_title: r.title,
      appliance: r.appliance,
    })
  }

  const toggleChecked = (key) =>
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  // Combine ingredients across all recipes on the shopping list into one
  // de-duplicated list.
  const shoppingItems = useMemo(() => {
    const map = new Map()
    for (const r of allRecipes) {
      if (!onList.has(r.id)) continue
      for (const ing of r.ingredients) {
        const key = ing.trim().toLowerCase()
        if (!map.has(key)) {
          map.set(key, { key, text: ing.trim(), sources: new Set(), count: 0 })
        }
        const item = map.get(key)
        item.sources.add(r.title)
        item.count += 1
      }
    }
    return [...map.values()]
      .map((i) => ({ ...i, sources: [...i.sources] }))
      .sort((a, b) => a.text.localeCompare(b.text))
  }, [onList, allRecipes])

  const toggleFavorite = (id) =>
    setFavorites((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allRecipes.filter((r) => {
      if (favsOnly && !favorites.has(r.id)) return false
      if (meal !== 'all' && !r.meals.includes(meal)) return false
      if (appliance !== 'all' && r.appliance !== appliance) return false
      if (activeTags.length && !activeTags.every((t) => r.tags.includes(t))) return false
      if (q) {
        const haystack = (
          r.title +
          ' ' +
          r.cuisine +
          ' ' +
          r.ingredients.join(' ') +
          ' ' +
          r.tags.join(' ')
        ).toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [meal, appliance, activeTags, query, favsOnly, favorites, allRecipes])

  const toggleTag = (tag) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )

  const resetFilters = () => {
    setMeal('all')
    setAppliance('all')
    setActiveTags([])
    setQuery('')
    setFavsOnly(false)
  }

  // Build a one-day plan, honouring the current appliance filter so it stays
  // relevant if the user is browsing just one device.
  const makePlan = () => {
    const pool = appliance === 'all'
      ? allRecipes
      : allRecipes.filter((r) => r.appliance === appliance)
    setPlan({
      breakfast: pickRandom(pool, 'breakfast'),
      lunch: pickRandom(pool, 'lunch'),
      dinner: pickRandom(pool, 'dinner'),
    })
    track('plan_generated', { appliance })
  }

  const hasFilters =
    meal !== 'all' || appliance !== 'all' || activeTags.length > 0 || query || favsOnly

  return (
    <div className="app">
      <Header
        query={query}
        setQuery={setQuery}
        count={recipes.length}
        listCount={onList.size}
        onOpenList={() => setShowList(true)}
        onOpenHelp={() => setShowHelp(true)}
        onOpenPantry={() => {
          setShowPantry(true)
          track('pantry_opened', { location: 'header' })
        }}
        onOpenImport={() => {
          setImportState({ url: '', fromShare: false })
          track('reel_import_opened', { location: 'header' })
        }}
      />

      <main className="container">
        <Planner plan={plan} onPlan={makePlan} onClear={() => setPlan(null)} onOpen={openRecipe} />

        <FilterBar
          meal={meal}
          setMeal={setMeal}
          appliance={appliance}
          setAppliance={setAppliance}
          availableAppliances={availableAppliances}
          activeTags={activeTags}
          toggleTag={toggleTag}
          favsOnly={favsOnly}
          setFavsOnly={setFavsOnly}
          favCount={favorites.size}
        />

        <div className="results-row">
          <p className="results-count">
            {filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'}
            {hasFilters && ' match your filters'}
          </p>
          {hasFilters && (
            <button className="link-btn" onClick={resetFilters}>
              Clear all
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState favsOnly={favsOnly} onReset={resetFilters} />
        ) : (
          <div className="grid">
            {filtered.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                isFav={favorites.has(r.id)}
                onToggleFav={() => toggleFavorite(r.id)}
                isOnList={onList.has(r.id)}
                onToggleList={() => toggleList(r.id)}
                onOpen={() => openRecipe(r)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        {AFFILIATE_ENABLED && (
          <div className="footer-gear">
            <h4>🍳 The appliances behind these recipes</h4>
            <div className="gear-links">
              <a
                href={buyUrl('airfryer')}
                target="_blank"
                rel="sponsored nofollow noopener noreferrer"
                onClick={() => track('affiliate_click', { appliance: 'airfryer', location: 'footer' })}
              >
                🌀 {productName('airfryer')}
              </a>
              <a
                href={buyUrl('steamer')}
                target="_blank"
                rel="sponsored nofollow noopener noreferrer"
                onClick={() => track('affiliate_click', { appliance: 'steamer', location: 'footer' })}
              >
                ♨️ {productName('steamer')}
              </a>
            </div>
            <p className="disclosure">{DISCLOSURE}</p>
          </div>
        )}
        <p>
          🍳 Foodiee — recipes for the <strong>Philips Airfryer</strong> &amp;{' '}
          <strong>Wipro Multi Cooker</strong>.
        </p>
        <p className="footer-links">
          <a href="/privacy">Privacy Policy</a>
          <span aria-hidden="true"> · </span>
          <a
            href={SUGGEST_MAILTO}
            onClick={() => track('suggest_recipe_click', { location: 'footer' })}
          >
            💡 Suggest a recipe
          </a>
        </p>
      </footer>

      {selected && (
        <RecipeModal
          recipe={selected}
          isFav={favorites.has(selected.id)}
          onToggleFav={() => toggleFavorite(selected.id)}
          isOnList={onList.has(selected.id)}
          onToggleList={() => toggleList(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}

      {showList && (
        <ShoppingList
          items={shoppingItems}
          listCount={onList.size}
          checked={checked}
          onToggle={toggleChecked}
          onCheckAll={() => setChecked(new Set(shoppingItems.map((i) => i.key)))}
          onClearChecks={() => setChecked(new Set())}
          onClearList={() => {
            setOnList(new Set())
            setChecked(new Set())
          }}
          onClose={() => setShowList(false)}
        />
      )}

      {showHelp && <HowItWorks onClose={() => setShowHelp(false)} />}

      {showPantry && (
        <Pantry
          pantry={pantry}
          recipes={allRecipes}
          onToggleItem={togglePantryItem}
          onToggleCategory={togglePantryCategory}
          onClear={() => setPantry(new Set())}
          onOpenRecipe={(r) => {
            setShowPantry(false)
            openRecipe(r)
          }}
          onClose={() => setShowPantry(false)}
        />
      )}

      {importState && (
        <ImportRecipe
          initialUrl={importState.url}
          fromShare={importState.fromShare}
          onImported={(recipe) => {
            // Register (or refresh) the imported recipe, then open it for review.
            setImportedRecipes((prev) => [recipe, ...prev.filter((r) => r.id !== recipe.id)])
            setImportState(null)
            setSelected(recipe)
            track('reel_recipe_created', { recipe_id: recipe.id, appliance: recipe.appliance })
            attachRecipeImage(recipe) // generate a hero photo in the background
          }}
          onClose={() => setImportState(null)}
        />
      )}
    </div>
  )
}

function Header({
  query,
  setQuery,
  count,
  listCount,
  onOpenList,
  onOpenHelp,
  onOpenPantry,
  onOpenImport,
}) {
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="brand">
          <span className="brand-logo">🍳</span>
          <div>
            <h1 className="brand-title">Foodiee</h1>
            <p className="brand-sub">
              {count} recipes for the air fryer &amp; steamer
            </p>
          </div>
        </div>
        <div className="header-tools">
          <div className="search">
            <span className="search-icon">🔎</span>
            <input
              type="search"
              placeholder="Search recipes, ingredients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search recipes"
            />
          </div>
          <button
            className="import-btn"
            onClick={onOpenPantry}
            aria-label="My Pantry — find recipes from what you have"
            title="My Pantry — find recipes from what you have"
          >
            🥫
            <span className="import-btn-text">Pantry</span>
          </button>
          <button
            className="import-btn"
            onClick={onOpenImport}
            aria-label="Import a recipe from an Instagram reel"
            title="Import a recipe from an Instagram reel"
          >
            🎬
            <span className="import-btn-text">Import reel</span>
          </button>
          <button
            className="help-btn"
            onClick={onOpenHelp}
            aria-label="How it works"
            title="How it works"
          >
            ?
          </button>
          <button className="list-btn" onClick={onOpenList} aria-label="Open shopping list">
            🛒
            <span className="list-btn-text">List</span>
            {listCount > 0 && <span className="list-badge">{listCount}</span>}
          </button>
        </div>
      </div>
    </header>
  )
}

function Planner({ plan, onPlan, onClear, onOpen }) {
  return (
    <section className="planner">
      <div className="planner-head">
        <div>
          <h2 className="planner-title">🎲 Plan my day</h2>
          <p className="planner-sub">
            Get a random breakfast, lunch &amp; dinner you can make today.
          </p>
        </div>
        <div className="planner-actions">
          <button className="btn" onClick={onPlan}>
            {plan ? '🔄 Shuffle' : '✨ Generate'}
          </button>
          {plan && (
            <button className="link-btn" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {plan && (
        <div className="plan-strip">
          {['breakfast', 'lunch', 'dinner'].map((slot) => {
            const r = plan[slot]
            return (
              <div key={slot} className="plan-slot">
                <span className="plan-slot-label">
                  {MEALS[slot].emoji} {MEALS[slot].label}
                </span>
                {r ? (
                  <button className="plan-pick" onClick={() => onOpen(r)} style={{ '--c': r.color }}>
                    <span className="plan-pick-emoji">
                      {IMAGES[r.id] ? (
                        <img
                          className="plan-pick-img"
                          src={imageSrc(IMAGES[r.id])}
                          alt={r.title}
                          onError={(e) => {
                            e.currentTarget.replaceWith(
                              document.createTextNode(r.emoji),
                            )
                          }}
                        />
                      ) : (
                        r.emoji
                      )}
                    </span>
                    <span className="plan-pick-info">
                      <strong>{r.title}</strong>
                      <small>
                        {APPLIANCES[r.appliance].emoji} {APPLIANCES[r.appliance].label} · ⏱ {r.time} min
                      </small>
                    </span>
                  </button>
                ) : (
                  <div className="plan-pick plan-empty">No match — try a different appliance</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function FilterBar({
  meal,
  setMeal,
  appliance,
  setAppliance,
  availableAppliances,
  activeTags,
  toggleTag,
  favsOnly,
  setFavsOnly,
  favCount,
}) {
  return (
    <div className="filters">
      <div className="filter-group">
        <span className="filter-label">Meal</span>
        <div className="chips">
          <Chip active={meal === 'all'} onClick={() => setMeal('all')}>
            All
          </Chip>
          {Object.entries(MEALS).map(([key, m]) => (
            <Chip key={key} active={meal === key} onClick={() => setMeal(key)}>
              {m.emoji} {m.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-label">Appliance</span>
        <div className="chips">
          <Chip
            active={appliance === 'all'}
            onClick={() => setAppliance('all')}
          >
            All
          </Chip>
          {Object.entries(APPLIANCES)
            .filter(([key]) => !availableAppliances || availableAppliances.has(key))
            .map(([key, a]) => (
              <Chip
                key={key}
                active={appliance === key}
                onClick={() => setAppliance(key)}
              >
                {a.emoji} {a.label}
              </Chip>
            ))}
          <Chip active={favsOnly} onClick={() => setFavsOnly((v) => !v)}>
            ❤️ Favorites{favCount ? ` (${favCount})` : ''}
          </Chip>
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-label">Tags</span>
        <div className="chips">
          {ALL_TAGS.map((tag) => (
            <Chip
              key={tag}
              small
              active={activeTags.includes(tag)}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children, small }) {
  return (
    <button
      className={`chip${active ? ' chip-active' : ''}${small ? ' chip-small' : ''}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

function RecipeCard({ recipe, onOpen, isFav, onToggleFav, isOnList, onToggleList }) {
  const appliance = APPLIANCES[recipe.appliance]
  return (
    <article className="card-wrap">
      <button className="card" onClick={onOpen} type="button">
        <div className="card-hero" style={{ background: recipe.color }}>
          {(recipe.image || IMAGES[recipe.id]) && (
            <img
              className="card-photo"
              src={recipe.image || imageSrc(IMAGES[recipe.id])}
              alt={recipe.title}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
          <span className="card-emoji">{recipe.emoji}</span>
          <span className="card-appliance" title={appliance.full}>
            {appliance.emoji} {appliance.label}
          </span>
        </div>
        <div className="card-body">
          <h3 className="card-title">{recipe.title}</h3>
          <p className="card-cuisine">{recipe.cuisine}</p>
          <div className="card-meta">
            <span>⏱ {recipe.time} min</span>
            <span>•</span>
            <span>{recipe.difficulty}</span>
            <span>•</span>
            <span>🍽 {recipe.servings}</span>
          </div>
          <div className="card-meals">
            {recipe.meals.map((m) => (
              <span key={m} className="meal-tag">
                {MEALS[m].emoji} {MEALS[m].label}
              </span>
            ))}
          </div>
        </div>
      </button>
      <div className="card-actions">
        <button
          className={`icon-btn cart-btn${isOnList ? ' cart-on' : ''}`}
          onClick={onToggleList}
          type="button"
          aria-pressed={isOnList}
          aria-label={isOnList ? 'Remove from shopping list' : 'Add to shopping list'}
          title={isOnList ? 'Remove from shopping list' : 'Add ingredients to shopping list'}
        >
          {isOnList ? '✓' : '🛒'}
        </button>
        <button
          className={`icon-btn fav-btn${isFav ? ' fav-on' : ''}`}
          onClick={onToggleFav}
          type="button"
          aria-pressed={isFav}
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFav ? '❤️' : '🤍'}
        </button>
      </div>
    </article>
  )
}

function EmptyState({ onReset, favsOnly }) {
  return (
    <div className="empty">
      <span className="empty-emoji">{favsOnly ? '💔' : '🥲'}</span>
      <h3>
        {favsOnly
          ? 'No favorites yet'
          : 'No recipes match these filters'}
      </h3>
      <p>
        {favsOnly
          ? 'Tap the heart on any recipe to save it here.'
          : 'Try removing a tag or switching the appliance.'}
      </p>
      <button className="btn" onClick={onReset}>
        Clear filters
      </button>
      {!favsOnly && (
        <p className="empty-suggest">
          Can't find what you're after?{' '}
          <a
            href={SUGGEST_MAILTO}
            onClick={() => track('suggest_recipe_click', { location: 'empty' })}
          >
            Suggest a recipe →
          </a>
        </p>
      )}
    </div>
  )
}
