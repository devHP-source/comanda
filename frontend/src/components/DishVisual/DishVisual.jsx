import styles from './DishVisual.module.css'

const TONES = ['dumpling', 'noodles', 'chicken', 'pizza']

const toneFor = (seed = '') => TONES[[...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % TONES.length] // Same dish code --> same tone on every render, so the placeholders don't change color

const DishVisual = ({ seed, className = '' }) => ( // Placeholder for a dish without a photo: fills its parent box
  <div aria-hidden="true" className={`${styles.visual} ${styles[toneFor(seed)]} ${className}`}>
    <div className={styles.plate}>
      <span />
      <span />
      <span />
    </div>
  </div>
)

export default DishVisual
