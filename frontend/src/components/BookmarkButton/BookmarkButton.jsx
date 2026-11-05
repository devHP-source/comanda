import Icon from '../Icon/Icon.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import useList from '../../hooks/useList.js'
import styles from './BookmarkButton.module.css'

// Adds or removes a dish from "La mia lista". "round": icon only, over the card photo. "pill": icon + text, in the dish sheet
const BookmarkButton = ({ dish, variant = 'round', className = '' }) => {
  const { t, pick } = useLanguage()
  const { has, toggle } = useList()
  const isSaved = has(dish._id)
  const isRound = variant === 'round'

  return (
    <button
      type="button"
      className={`${isRound ? styles.round : styles.pill} ${isSaved ? styles.saved : ''} ${className}`}
      aria-label={isRound ? t(isSaved ? 'list.removeDish' : 'list.addDish', { name: pick(dish.name) }) : undefined}
      onClick={() => toggle(dish._id)}
    >
      <Icon name="bookmark" size={isRound ? 20 : 18} />
      {!isRound && t(isSaved ? 'list.remove' : 'list.add')}
    </button>
  )
}

export default BookmarkButton
