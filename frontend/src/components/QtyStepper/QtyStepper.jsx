import useLanguage from '../../hooks/useLanguage.js'
import styles from './QtyStepper.module.css'

const MAX_QTY = 99 // same limit as the Order schema

const QtyStepper = ({ qty, label, onChange }) => { // − qty + for one ticket line. Going below 1 removes the line (the parent decides). `label` names the dish for screen readers
  const { t } = useLanguage()

  return (
    <div className={styles.stepper} role="group" aria-label={t('newTicket.qtyFor', { name: label })}>
      <button
        type="button"
        className={styles.step}
        aria-label={qty === 1 ? t('newTicket.remove', { name: label }) : t('newTicket.decrease', { name: label })}
        onClick={() => onChange(qty - 1)}
      >
        −
      </button>
      <span className={styles.qty} aria-live="polite">{qty}</span>
      <button
        type="button"
        className={styles.step}
        aria-label={t('newTicket.increase', { name: label })}
        disabled={qty >= MAX_QTY}
        onClick={() => onChange(qty + 1)}
      >
        +
      </button>
    </div>
  )
}

export default QtyStepper
