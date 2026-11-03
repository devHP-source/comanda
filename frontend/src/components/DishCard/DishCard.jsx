import DishVisual from '../DishVisual/DishVisual.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import formatPrice from '../../utils/formatPrice.js'
import thumbnailUrl from '../../utils/thumbnailUrl.js'
import styles from './DishCard.module.css'

const CARD_THUMBNAIL = 'c_fill,ar_1:1,f_auto,q_auto,w_300' // square crop: the photo column fills the card's height

const DishCard = ({ dish }) => { // One menu row: text on the left, photo on the right
  const { t, pick } = useLanguage()
  const description = pick(dish.description)
  const isSoldOut = !dish.isAvailable

  return (
    <article className={`${styles.card} ${isSoldOut ? styles.soldOut : ''}`}>
      <div className={styles.copy}>
        <p className={styles.code}>
          <span className="visually-hidden">{t('dish.number')} </span>
          {dish.code}
        </p>

        <h3 className={styles.title}>
          {pick(dish.name)}
          {dish.isFrozen && ( // Italian law: frozen products carry an asterisk, explained in the menu note
            <>
              <span className={styles.frozen} aria-hidden="true">*</span>
              <span className="visually-hidden"> ({t('dish.frozen')})</span>
            </>
          )}
        </h3>

        {description && <p className={styles.description}>{description}</p>}

        {dish.allergens.length > 0 && (
          <p className={styles.allergens}>
            <strong>{t('dish.allergens')}:</strong>{' '}
            {dish.allergens.map((allergen) => t(`allergens.${allergen}`)).join(', ')}
          </p>
        )}

        <div className={styles.meta}>
          <span className={styles.price}>{formatPrice(dish.price)}</span>
          {isSoldOut && <span className={`${styles.tag} ${styles.tagSoldOut}`}>{t('dish.soldOut')}</span>}
          {dish.isVegetarian && <span className={styles.tag}>{t('dish.vegetarian')}</span>}
          {dish.spiceLevel > 0 && <span className={`${styles.tag} ${styles.tagSpicy}`}>{t('dish.spicy')}</span>}
        </div>
      </div>

      <div className={styles.media}>
        {dish.image?.url ? (
          <img
            className={styles.fill}
            src={thumbnailUrl(dish.image.url, CARD_THUMBNAIL)}
            alt="" // the dish name is right next to it
            loading="lazy"
            width="300"
            height="300"
          />
        ) : (
          <DishVisual seed={dish.code} className={styles.fill} />
        )}
      </div>
    </article>
  )
}

export default DishCard
