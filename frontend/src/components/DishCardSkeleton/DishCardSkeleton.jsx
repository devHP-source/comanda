import Skeleton from '../Skeleton/Skeleton.jsx'
import styles from './DishCardSkeleton.module.css'

const DishCardSkeleton = () => ( // Same box as DishCard, so nothing jumps when the menu arrives
  <div className={styles.card} aria-hidden="true">
    <div className={styles.copy}>
      <Skeleton width="2rem" height="0.75rem" />
      <Skeleton width="75%" height="1.3rem" />
      <Skeleton width="95%" height="0.85rem" />
      <Skeleton width="60%" height="0.85rem" />
      <Skeleton width="4rem" height="1rem" className={styles.price} />
    </div>
    <Skeleton height="auto" radius="var(--radius-md)" className={styles.media} />
  </div>
)

export default DishCardSkeleton
