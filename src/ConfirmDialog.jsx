import { useEffect } from 'react'

// Small in-app confirmation dialog — replaces window.confirm so prompts match
// Foodiee's look. Renders above whatever opened it (higher z-index).
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, onConfirm])

  return (
    <div
      className="modal-overlay confirm-overlay"
      onClick={(e) => {
        e.stopPropagation()
        onCancel()
      }}
    >
      <div
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title || 'Confirm'}
      >
        {title && <h3 className="confirm-title">{title}</h3>}
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`btn${danger ? ' btn-danger' : ''}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
