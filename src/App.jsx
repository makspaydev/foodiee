import { useMemo, useState, useEffect } from 'react'
import { recipes, MEALS, APPLIANCES, ALL_TAGS } from './recipes.js'
import RecipeModal from './RecipeModal.jsx'
import ShoppingList from './ShoppingList.jsx'

const FAV_KEY = 'foodiee:favorites'
const LIST_KEY = 'foodiee:list'
const CHECKED_KEY = 'foodiee:checked'

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

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem(LIST_KEY, JSON.stringify([...onList]))
  }, [onList])

  useEffect(() => {
    localStorage.setItem(CHECKED_KEY, JSON.stringify([...checked]))
  }, [checked])

  const toggleList = (id) =>
    setOnList((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

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
    for (const r of recipes) {
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
  }, [onList])

  const toggleFavorite = (id) =>
    setFavorites((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return recipes.filter((r) => {
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
  }, [meal, appliance, activeTags, query, favsOnly, favorites])

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
      ? recipes
      : recipes.filter((r) => r.appliance === appliance)
    setPlan({
      breakfast: pickRandom(pool, 'breakfast'),
      lunch: pickRandom(pool, 'lunch'),
      dinner: pickRandom(pool, 'dinner'),
    })
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
      />

      <main className="container">
        <Planner plan={plan} onPlan={makePlan} onClear={() => setPlan(null)} onOpen={setSelected} />

        <FilterBar
          meal={meal}
          setMeal={setMeal}
          appliance={appliance}
          setAppliance={setAppliance}
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
                onOpen={() => setSelected(r)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          🍳 Foodiee — internal recipe collection for our{' '}
          <strong>Philips Airfryer</strong> &amp;{' '}
          <strong>Wipro Multi Cooker</strong>.
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
          onClearChecks={() => setChecked(new Set())}
          onClearList={() => {
            setOnList(new Set())
            setChecked(new Set())
          }}
          onClose={() => setShowList(false)}
        />
      )}
    </div>
  )
}

function Header({ query, setQuery, count, listCount, onOpenList }) {
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
                    <span className="plan-pick-emoji">{r.emoji}</span>
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
          {Object.entries(APPLIANCES).map(([key, a]) => (
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
    </div>
  )
}
