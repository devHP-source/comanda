import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router'
import api, { getErrorCode } from '../../../api/client.js'
import DishVisual from '../../../components/DishVisual/DishVisual.jsx'
import Icon from '../../../components/Icon/Icon.jsx'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import formatPrice from '../../../utils/formatPrice.js'
import thumbnailUrl from '../../../utils/thumbnailUrl.js'
import styles from './DishSheet.module.css'

const SHEET_PHOTO = 'c_fill,ar_4:3,f_auto,q_auto,w_800' // bigger than the card thumbnail, same crop
const NOT_FOUND_CODES = ['DISH_NOT_FOUND', 'INVALID_ID'] // unpublished, deleted or a broken link

// /menu/dish/:id, drawn over the menu: bottom sheet on phones, centered modal from tablet up
const DishSheet = () => {
  const { id } = useParams()
  const menu = useOutletContext() // the menu page's data, null while it loads
  const navigate = useNavigate()
  const location = useLocation()
  const { lang, t, pick, tError } = useLanguage()
  const dialogRef = useRef(null)
  const titleId = useId()
  const [fetched, setFetched] = useState({ id: null }) // { id, dish } or { id, error }
  const [attempt, setAttempt] = useState(0)

  const menuDish = menu?.dishes.find((dish) => dish._id === id)

  useEffect(() => { // Opened from the menu: the dish is already there. Direct link: load it on its own, the menu may still be loading
    if (menuDish) return
    let ignore = false

    api.get(`/dishes/${id}`)
      .then(({ data }) => {
        if (!ignore) setFetched({ id, dish: data })
      })
      .catch((err) => {
        if (!ignore) setFetched({ id, error: err })
      })

    return () => {
      ignore = true
    }
  }, [id, menuDish, attempt])

  useEffect(() => { // No cleanup: closing here would navigate away under StrictMode's test unmount
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
  }, [])

  const handleClose = () => { // native close: Esc, Android back, backdrop, close button
    if (location.state?.fromMenu) navigate(-1) // back to the menu entry, so the browser's back button doesn't reopen the dish
    else navigate('/menu', { replace: true }) // opened from a shared link: there is no menu entry behind it
  }

  const handleBackdropClick = (event) => { // the content fills the dialog, so a click on the dialog itself is on the backdrop
    if (event.target === dialogRef.current) dialogRef.current.close()
  }

  const handleRetry = () => {
    setFetched({ id: null })
    setAttempt((current) => current + 1)
  }

  const isCurrent = fetched.id === id
  const dish = menuDish ?? (isCurrent ? fetched.dish : null)
  const error = !menuDish && isCurrent ? fetched.error : null
  const category = dish && menu?.categories.find((item) => item._id === dish.category)

  let content
  if (dish) {
    const name = pick(dish.name)
    const description = pick(dish.description)
    const isSoldOut = !dish.isAvailable

    content = (
      <div className={styles.dish}>
        <div className={`${styles.media} ${isSoldOut ? styles.soldOutMedia : ''}`}>
          {dish.image?.url ? (
            <img
              className={styles.fill}
              src={thumbnailUrl(dish.image.url, SHEET_PHOTO)}
              alt="" // the dish name is the dialog's title
              width="800"
              height="600"
            />
          ) : (
            <DishVisual seed={dish.code} className={styles.fill} />
          )}
        </div>

        <div className={styles.body}>
          <p className={styles.kicker}>
            <span className={styles.code}>
              <span className="visually-hidden">{t('dish.number')} </span>
              {dish.code}
            </span>
            {category && pick(category.name)}
          </p>

          <h2 id={titleId} className={`${styles.title} ${isSoldOut ? styles.soldOutText : ''}`}>
            {name}
            {dish.isFrozen && (
              <>
                <span className={styles.frozen} aria-hidden="true">*</span>
                <span className="visually-hidden"> ({t('dish.frozen')})</span>
              </>
            )}
          </h2>

          {lang !== 'it' && name !== dish.name.it && ( // tourists can point at the Italian name when they talk to the waiter
            <p className={styles.italianName}>
              {t('dishSheet.italianName')}: <span lang="it">{dish.name.it}</span>
            </p>
          )}

          <div className={styles.meta}>
            <span className={`${styles.price} ${isSoldOut ? styles.soldOutText : ''}`}>{formatPrice(dish.price)}</span>
            {isSoldOut && <span className={`${styles.tag} ${styles.tagSoldOut}`}>{t('dish.soldOut')}</span>}
            {dish.isVegetarian && <span className={styles.tag}>{t('dish.vegetarian')}</span>}
            {dish.spiceLevel > 0 && <span className={`${styles.tag} ${styles.tagSpicy}`}>{t('dish.spicy')}</span>}
          </div>

          {description && <p className={styles.description}>{description}</p>}

          {dish.allergens.length > 0 && (
            <section className={styles.allergens} aria-labelledby={`${titleId}-allergens`}>
              <h3 id={`${titleId}-allergens`} className={styles.allergensTitle}>{t('dish.allergens')}</h3>
              <ul className={styles.allergenList}>
                {dish.allergens.map((allergen) => (
                  <li key={allergen} className={styles.allergen}>{t(`allergens.${allergen}`)}</li>
                ))}
              </ul>
            </section>
          )}

          <div className={styles.note}>
            {dish.isFrozen && <p>{t('menu.noteFrozen')}</p>}
            <p>{t('menu.noteAllergens')}</p>
          </div>
        </div>
      </div>
    )
  } else if (error) {
    const isNotFound = NOT_FOUND_CODES.includes(getErrorCode(error))

    content = (
      <div className={styles.message} role="alert">
        <h2 id={titleId} className={styles.messageTitle}>
          {t(isNotFound ? 'dishSheet.notFoundTitle' : 'dishSheet.errorTitle')}
        </h2>
        <p className={styles.messageText}>{isNotFound ? t('dishSheet.notFoundText') : tError(error)}</p>
        <button
          type="button"
          className={styles.button}
          onClick={isNotFound ? () => dialogRef.current.close() : handleRetry}
        >
          {t(isNotFound ? 'dishSheet.backToMenu' : 'menu.retry')}
        </button>
      </div>
    )
  } else {
    content = (
      <div className={styles.pending}> {/* keeps its size during the skeleton's 200 ms delay */}
        <LoadingState>
          <div className={styles.loading}>
            <Skeleton height="auto" radius="0" className={styles.mediaSkeleton} />
            <div className={styles.body}>
              <Skeleton width="3rem" height="1.4rem" />
              <Skeleton width="70%" height="1.9rem" />
              <Skeleton width="5rem" height="1.4rem" />
            </div>
          </div>
        </LoadingState>
      </div>
    )
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={dish || error ? titleId : undefined}
      aria-label={dish || error ? undefined : t('dishSheet.label')}
      onClose={handleClose}
      onClick={handleBackdropClick}
    >
      <button
        type="button"
        className={styles.close}
        aria-label={t('dishSheet.close')}
        onClick={() => dialogRef.current.close()}
      >
        <Icon name="close" size={22} />
      </button>

      <div className={styles.scroll}>{content}</div>
    </dialog>
  )
}

export default DishSheet
