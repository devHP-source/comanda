import { Link } from 'react-router'
import DishVisual from '../DishVisual/DishVisual.jsx'
import Icon from '../Icon/Icon.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import formatPrice from '../../utils/formatPrice.js'
import thumbnailUrl from '../../utils/thumbnailUrl.js'
import styles from './FeaturedDishes.module.css'

const FeaturedDishes = ({ dishes }) => { // "Consigliati dallo chef": swipeable row on mobile and tablet, grid on desktop
  const { t, pick } = useLanguage()

  return (
    <section className={styles.section} aria-labelledby="featured-title">
      <p className={styles.kicker}>
        <Icon name="sparkle" size={15} />
        {t('menu.featuredKicker')}
      </p>
      <h2 id="featured-title" className={styles.title}>{t('menu.featuredTitle')}</h2>

      <ul className={`${styles.strip} hide-scrollbar`}>
        {dishes.map((dish) => (
          <li key={dish._id} className={styles.card}>
            <div className={styles.media}>
              {dish.image?.url ? (
                <img
                  className={styles.fill}
                  src={thumbnailUrl(dish.image.url)}
                  alt="" // the dish name is right under it
                  loading="lazy"
                  width="400"
                  height="300"
                />
              ) : (
                <DishVisual seed={dish.code} className={styles.fill} />
              )}
            </div>

            <div className={styles.copy}>
              <p className={styles.code}>
                <span className="visually-hidden">{t('dish.number')} </span>
                {dish.code}
              </p>
              <h3 className={styles.name}>
                <Link to={`/menu/dish/${dish._id}`} state={{ fromMenu: true }} className={styles.link}>
                  {pick(dish.name)}
                </Link>
                {dish.isFrozen && (
                  <>
                    <span className={styles.frozen} aria-hidden="true">*</span>
                    <span className="visually-hidden"> ({t('dish.frozen')})</span>
                  </>
                )}
              </h3>
              <p className={styles.price}>{formatPrice(dish.price)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default FeaturedDishes
