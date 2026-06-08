import { useEffect, useState } from 'react'
import { MEALS, APPLIANCES } from './recipes.js'
import { IMAGES } from './imageManifest.js'
import { AFFILIATE_ENABLED, buyUrl, productName } from './affiliate.js'
import { track } from './analytics.js'
import { matchRecipe, hasPantryTags } from './pantryMatch.js'

const imageSrc = (file) => `${import.meta.env.BASE_URL}images/${file}`

export default function RecipeModal({
  recipe,
  pantry,
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

  // Pantry-aware: how much of this recipe you already have, and what's the gap.
  const pantryActive = pantry && pantry.size > 0 && hasPantryTags(recipe)
  const match = pantryActive ? matchRecipe(recipe, pantry) : null

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
          {(recipe.image || IMAGES[recipe.id]) && (
            <img
              className="modal-photo"
              src={recipe.image || imageSrc(IMAGES[recipe.id])}
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

          {match && (
            <p className="modal-pantry">
              🥫 From your pantry: <strong>{match.haveCount}/{match.total}</strong> on hand
              {match.missingCount > 0 ? (
                <>
                  {' '}· you'll buy <strong>{match.missingCount}</strong>:{' '}
                  <span className="modal-pantry-gap">
                    {match.missing.map((t) => t.canon).join(', ')}
                  </span>
                </>
              ) : (
                <> · you have everything! 🎉</>
              )}
            </p>
          )}

          <button
            className={`btn list-toggle${isOnList ? ' on' : ''}`}
            onClick={onToggleList}
            aria-pressed={isOnList}
          >
            {isOnList
              ? '✓ On your shopping list — tap to remove'
              : match && match.missingCount > 0
                ? `🛒 Add — buy just the ${match.missingCount} you're missing`
                : match && match.missingCount === 0
                  ? '🛒 Add to list — you have it all!'
                  : '🛒 Add ingredients to shopping list'}
          </button>

          <div className="modal-stats">
            <Stat label="Appliance" value={`${appliance.emoji} ${appliance.full}`} />
            <Stat label="Setting" value={recipe.setting} />
            <Stat label="Total time" value={`⏱ ${recipe.time} min`} />
            <Stat label="Difficulty" value={recipe.difficulty} />
            <Stat label="Serves" value={recipe.servings} />
          </div>

          {recipe.equipment?.length > 0 && (
            <p className="modal-equipment">
              🧰 Also uses:{' '}
              {recipe.equipment
                .map((k) => (APPLIANCES[k] ? `${APPLIANCES[k].emoji} ${APPLIANCES[k].label}` : null))
                .filter(Boolean)
                .join('  ·  ')}
            </p>
          )}

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
