import { useEffect, useId, useRef, useState } from 'react'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './ConfirmDialog.module.css'

// Asks before every action that changes data. The parent owns `open` and closes it in `onClose`.
const ConfirmDialog = ({ // `onConfirm` runs the request and toasts its own errors, the dialog stays disabled until it settles, then closes.
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  children, // optional extra content under the message (e.g. a count loaded when the dialog opens), shown before the buttons
  onConfirm,
  onClose,
}) => {
  const { t } = useLanguage()
  const [isBusy, setIsBusy] = useState(false)
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => { // Sync the native dialog with the `open` prop
    const dialog = dialogRef.current
    if (open && !dialog.open) {
      dialog.showModal()
      const focusTarget = destructive ? cancelRef : confirmRef // destructive: focus Annulla so a quick Enter doesn't delete anything
      focusTarget.current.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, destructive])

  const handleConfirm = async () => {
    setIsBusy(true) // disables the buttons at once: a double tap can't send twice
    try {
      await onConfirm()
    } finally {
      setIsBusy(false)
      dialogRef.current?.close()
    }
  }

  const handleCancel = (event) => { // Esc key
    if (isBusy) event.preventDefault()
  }

  const handleBackdropClick = (event) => { // the inner box fills the dialog, so a click on the dialog itself is on the backdrop
    if (event.target === dialogRef.current && !isBusy) dialogRef.current.close()
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
      onCancel={handleCancel}
      onClose={onClose} // native close (Esc, backdrop, Annulla, after confirm), the parent sets open = false
      onClick={handleBackdropClick}
    >
      <div className={styles.box}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        {message && <p id={messageId} className={styles.message}>{message}</p>}
        {children}

        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancel}
            disabled={isBusy}
            onClick={() => dialogRef.current.close()}
          >
            {cancelLabel || t('confirm.cancel')}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`${styles.confirm} ${destructive ? styles.destructive : ''}`}
            disabled={isBusy}
            aria-busy={isBusy}
            onClick={handleConfirm}
          >
            {isBusy && <span className={styles.spinner} aria-hidden="true" />}
            {confirmLabel || t('confirm.confirm')}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default ConfirmDialog
