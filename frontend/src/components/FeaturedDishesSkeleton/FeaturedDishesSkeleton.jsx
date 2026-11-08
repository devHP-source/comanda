import Skeleton from '../Skeleton/Skeleton.jsx'
import realStyles from '../FeaturedDishes/FeaturedDishes.module.css' // the real component's classes: same sizes at every breakpoint
import styles from './FeaturedDishesSkeleton.module.css'

const CARDS = 3

const FeaturedDishesSkeleton = () => (
  <div className={realStyles.section}>
    <Skeleton width="8rem" height="1.125rem" />
    <Skeleton width="min(17rem, 100%)" height="1.78rem" className={realStyles.title} />

    <div className={`${realStyles.strip} hide-scrollbar`}>
      {Array.from({ length: CARDS }, (_, index) => (
        <div key={index} className={realStyles.card}>
          <div className={realStyles.media}>
            <Skeleton height="100%" radius="0" className={realStyles.fill} />
          </div>

          <div className={realStyles.copy}>
            <Skeleton width="1.8rem" height="1.55rem" radius="0.35rem" className={styles.code} />
            <div className={styles.name}>
              <Skeleton height="1rem" />
              <Skeleton width="60%" height="1rem" />
            </div>
            <Skeleton width="3.5rem" height="1.3125rem" />
          </div>
        </div>
      ))}
    </div>
  </div>
)

export default FeaturedDishesSkeleton
