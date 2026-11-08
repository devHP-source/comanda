import Icon from '../Icon/Icon.jsx'
import QtyStepper from '../QtyStepper/QtyStepper.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import formatPrice from '../../utils/formatPrice.js'
import styles from './TicketSummary.module.css'

// The ticket being written. `lines` = [{ key, dish, qty, notes }] with the full dish object.
// The same dish can have several lines with different notes ("2 Margherita" + "1 Margherita senza mozzarella")
const TicketSummary = ({ lines, onQtyChange, onNotesChange, onAddVariant }) => {
  const { t } = useLanguage()

  if (lines.length === 0) {
    return <p className={styles.empty}>{t('newTicket.emptyTicket')}</p>
  }

  return (
    <ul className={styles.lines}>
      {lines.map(({ key, dish, qty, notes }) => {
        const name = dish.name.it // staff screens use the Italian names, like the kitchen tickets
        const label = `${dish.code} ${name}`
        const isSoldOut = !dish.isAvailable

        return (
          <li key={key} className={`${styles.line} ${isSoldOut ? styles.soldOut : ''}`} data-sold-out={isSoldOut || undefined}>
            <div className={styles.top}>
              <span className={styles.code}>{dish.code}</span>
              <span className={styles.name}>{name}</span>
              <span className={styles.price}>{formatPrice(dish.price * qty)}</span>
            </div>

            {isSoldOut && <p className={styles.warning} role="alert">{t('newTicket.lineSoldOut')}</p>}

            <div className={styles.controls}>
              <QtyStepper qty={qty} label={label} onChange={(next) => onQtyChange(key, next)} />
              <label className={styles.notes}>
                <span className="visually-hidden">{t('newTicket.notesFor', { name })}</span>
                <input
                  type="text"
                  className={styles.notesInput}
                  value={notes}
                  maxLength={200}
                  placeholder={t('newTicket.notesPlaceholder')}
                  onChange={(event) => onNotesChange(key, event.target.value)}
                />
              </label>
            </div>

            {!isSoldOut && (
              <button
                type="button"
                className={styles.variant}
                aria-label={t('newTicket.addVariantFor', { name: label })}
                onClick={() => onAddVariant(key)}
              >
                <Icon name="plus" size={18} />
                {t('newTicket.addVariant')}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default TicketSummary
