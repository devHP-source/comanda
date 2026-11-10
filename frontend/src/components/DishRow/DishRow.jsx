import { Link, useLocation } from 'react-router'
import BookmarkButton from '../BookmarkButton/BookmarkButton.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import formatPrice from '../../utils/formatPrice.js'
import styles from './DishRow.module.css'

// One line of a compact category (Bevande): number, name, price and bookmark, no photo. The whole row opens the dish sheet
const DishRow = ({ dish }) => {
  const { t, pick } = useLanguage()
  const { search } = useLocation() // keeps ?category=, so closing the sheet comes back to the same category
  const isSoldOut = !dish.isAvailable

  return (
    <div className={`${styles.row} ${isSoldOut ? styles.soldOut : ''}`}>
      <span className={styles.code}>
        <span className="visually-hidden">{t('dish.number')} </span>
        {dish.code}
      </span>

      <div className={styles.copy}>
        <h3 className={styles.name}>
          <Link to={{ pathname: `/menu/dish/${dish._id}`, search }} state={{ fromMenu: true }} className={styles.link}>
            {pick(dish.name)}
          </Link>
          {dish.isFrozen && ( // Italian law: frozen products carry an asterisk, explained in the menu note
            <>
              <span className={styles.frozen} aria-hidden="true">*</span>
              <span className="visually-hidden"> ({t('dish.frozen')})</span>
            </>
          )}
        </h3>
        {isSoldOut && <span className={styles.tag}>{t('dish.soldOut')}</span>}
      </div>

      <span className={styles.price}>{formatPrice(dish.price)}</span>

      <BookmarkButton dish={dish} className={styles.bookmark} />
    </div>
  )
}

export default DishRow
