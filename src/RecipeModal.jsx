import { useEffect, useState } from 'react'
import { MEALS, APPLIANCES } from './recipes.js'
import { IMAGES } from './imageManifest.js'
import { AFFILIATE_ENABLED, buyUrl, productName } from './affiliate.js'
import { track } from './analytics.js'

const imageSrc = (file) => `${import.meta.env.BASE_URL}images/${file}`

export default function RecipeModal({
  recipe,
  onClose,
  isFav,
  onToggleFav,
  isOnList,
  onToggleList,
}) {
  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const appliance = APPLIANCES[recipe.appliance]
  const [shared, setShared] = useState(false)

  const shareRecipe = async () => {
    const url = `${window.location.origin}/?recipe=${recipe.id}`
    const text = `${recipe.title} — an easy ${
      recipe.appliance === 'airfryer' ? 'air fryer' : 'steamer'
    } recipe on Foodiee 🍳`
    try {
      if (navigator.share) {
        await navigator.share({ title: `${recipe.title} — Foodiee`, text, url })
        track('recipe_share', { recipe_id: recipe.id, method: 'native' })
      } else {
        await navigator.clipboard.writeText(url)
        setShared(true)
        setTimeout(() => setShared(false), 1800)
        track('recipe_share', { recipe_id: recipe.id, method: 'copy' })
      }
    } catch {
      /* user cancelled the share sheet — ignore */
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={recipe.title}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <button
          className="modal-share"
          onClick={shareRecipe}
          aria-label="Share recipe"
          title="Share recipe"
        >
          🔗
        </button>
        {shared && <div className="share-toast">🔗 Link copied!</div>}
        <button
          className={`modal-fav${isFav ? ' fav-on' : ''}`}
          onClick={onToggleFav}
          aria-pressed={isFav}
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFav ? '❤️' : '🤍'}
        </button>

        <div className="modal-hero" style={{ background: recipe.color }}>
          {IMAGES[recipe.id] && (
            <img
              className="modal-photo"
              src={imageSrc(IMAGES[recipe.id])}
              alt={recipe.title}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
          <span className="modal-emoji">{recipe.emoji}</span>
        </div>

        <div className="modal-body">
          <div className="modal-meals">
            {recipe.meals.map((m) => (
              <span key={m} className="meal-tag">
                {MEALS[m].emoji} {MEALS[m].label}
              </span>
            ))}
          </div>

          <h2 className="modal-title">{recipe.title}</h2>
          <p className="modal-cuisine">{recipe.cuisine} cuisine</p>

          <button
            className={`btn list-toggle${isOnList ? ' on' : ''}`}
            onClick={onToggleList}
            aria-pressed={isOnList}
          >
            {isOnList
              ? '✓ On your shopping list — tap to remove'
              : '🛒 Add ingredients to shopping list'}
          </button>

          <div className="modal-stats">
            <Stat label="Appliance" value={`${appliance.emoji} ${appliance.full}`} />
            <Stat label="Setting" value={recipe.setting} />
            <Stat label="Total time" value={`⏱ ${recipe.time} min`} />
            <Stat label="Difficulty" value={recipe.difficulty} />
            <Stat label="Serves" value={recipe.servings} />
          </div>

          {AFFILIATE_ENABLED && (
            <a
              className="buy-appliance"
              href={buyUrl(recipe.appliance)}
              target="_blank"
              rel="sponsored nofollow noopener noreferrer"
              onClick={() =>
                track('affiliate_click', {
                  appliance: recipe.appliance,
                  location: 'recipe',
                  recipe_id: recipe.id,
                })
              }
            >
              🛒 Don't have one? Get the {productName(recipe.appliance)} on Amazon →
            </a>
          )}

          <div className="modal-columns">
            <section className="modal-section">
              <h3>🧺 Ingredients</h3>
              <ul className="ingredient-list">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i}>{ing}</li>
                ))}
              </ul>
            </section>

            <section className="modal-section">
              <h3>👩‍🍳 Method</h3>
              <ol className="step-list">
                {recipe.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </section>
          </div>

          <div className="modal-tags">
            {recipe.tags.map((t) => (
              <span key={t} className="chip chip-small chip-static">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}
