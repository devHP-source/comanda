import styles from './Skeleton.module.css'

const Skeleton = ({ width = '100%', height = '1rem', radius = 'var(--radius-sm)', className = '' }) => (
  <span
    aria-hidden="true"
    className={`${styles.skeleton} ${className}`}
    style={{ width, height, borderRadius: radius }}
  />
)

export default Skeleton
