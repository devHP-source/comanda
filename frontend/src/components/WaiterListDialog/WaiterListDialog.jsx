import { useEffect, useId, useRef } from 'react'
import Icon from '../Icon/Icon.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './WaiterListDialog.module.css'

// "Mostra al cameriere": the guest turns the phone towards the waiter. Italian names and dish numbers, large text.
// The parent owns `open` and sets it back to false in `onClose`
const WaiterListDialog = ({ open, dishes, onClose }) => {
  const { lang, t, tItalian, pick } = useLanguage()
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => { // Sync the native dialog with the `open` prop
    const dialog = dialogRef.current
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  const handleBackdropClick = (event) => { // the box fills the dialog, so a click on the dialog itself is on the backdrop
    if (event.target === dialogRef.current) dialogRef.current.close()
  }

  const isItalian = lang === 'it'

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose} // Esc, Android back, backdrop, close button
      onClick={handleBackdropClick}
    >
      <div className={styles.box}>
        <div className={styles.header}>
          <p className={styles.hint}>
            <Icon name="eye" size={18} />
            {t('waiterView.hint')}
          </p>
          <button
            type="button"
            className={styles.close}
            aria-label={t('waiterView.close')}
            onClick={() => dialogRef.current.close()}
          >
            <Icon name="close" size={22} />
          </button>
        </div>

        <div className={styles.scroll}>
          <div lang="it">
            <h2 id={titleId} className={styles.title}>{tItalian('waiterView.title')}</h2>
            <p className={styles.count}>
              {dishes.length === 1 ? tItalian('waiterView.countOne') : tItalian('waiterView.count', { count: dishes.length })}
            </p>
          </div>

          <ol className={styles.items}>
            {dishes.map((dish) => {
              const guestName = pick(dish.name)

              return (
                <li key={dish._id} className={styles.item}>
                  <span className={styles.code}>
                    <span className="visually-hidden" lang="it">{tItalian('dish.number')} </span>
                    {dish.code}
                  </span>
                  <span className={styles.names}>
                    <span className={styles.name} lang="it">{dish.name.it}</span>
                    {!isItalian && guestName !== dish.name.it && ( // the guest can still tell which dish is which
                      <span className={styles.guestName}>{guestName}</span>
                    )}
                  </span>
                  {!dish.isAvailable && <span className={styles.soldOut} lang="it">{tItalian('dish.soldOut')}</span>}
                </li>
              )
            })}
          </ol>

          <div className={styles.notOrder}>
            <p lang="it"><strong>{tItalian('waiterView.notOrder')}</strong></p>
            {!isItalian && <p>{t('waiterView.notOrder')}</p>}
          </div>
        </div>
      </div>
    </dialog>
  )
}

export default WaiterListDialog
