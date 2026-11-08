import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import api, { getErrorCode } from '../../api/client.js'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx'
import DishVisual from '../DishVisual/DishVisual.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import thumbnailUrl from '../../utils/thumbnailUrl.js'
import styles from './CategoryForm.module.css'

const ORDER_PATTERN = /^\d{1,3}$/ // whole number 0–999
const TILE_THUMBNAIL = 'c_fill,ar_4:3,f_auto,q_auto,w_240'
const FIELD_ORDER = ['nameIt', 'nameEn', 'order', 'coverDish'] // the first field with an error gets the focus

// Server validation paths --> form fields
const SERVER_FIELDS = { 'name.it': 'nameIt', 'name.en': 'nameEn', order: 'order', coverDish: 'coverDish' }
const FIELD_MESSAGES = {
  nameIt: 'categoryForm.errors.nameIt',
  order: 'categoryForm.errors.order',
  coverDish: 'categoryForm.errors.cover',
}

// Same rule as the menu preview: only published dishes with a photo can stand for the category. The API sends them sorted by code
const coverOptions = (dishes) => dishes.filter((dish) => dish.isPublished && dish.image?.url)

const initialValues = (category, nextOrder, options) => ({
  nameIt: category?.name.it ?? '',
  nameEn: category?.name.en ?? '',
  order: String(category?.order ?? nextOrder),
  // A saved cover that can't show any more (unpublished, photo removed) starts as "Automatica", which is what the menu shows anyway
  coverDish: options.some((dish) => dish._id === category?.coverDish) ? category.coverDish : '',
})

const validate = (values) => {
  const errors = {}
  if (!values.nameIt.trim()) errors.nameIt = FIELD_MESSAGES.nameIt
  if (!ORDER_PATTERN.test(values.order.trim())) errors.order = FIELD_MESSAGES.order
  return errors
}

const serverFieldErrors = (err) => { // a failed save --> messages under the fields concerned
  const code = getErrorCode(err)
  if (code === 'DUPLICATE_KEY') return { nameIt: 'categoryForm.errors.nameTaken' } // name.it is the only unique field
  if (code === 'INVALID_COVER_DISH') return { coverDish: FIELD_MESSAGES.coverDish }
  if (code !== 'VALIDATION_FAILED') return {}

  const errors = {}
  for (const path of Object.keys(err.response.data.errors ?? {})) {
    const field = SERVER_FIELDS[path]
    if (field) errors[field] = FIELD_MESSAGES[field] ?? 'categoryForm.errors.invalid'
  }
  return errors
}

const firstErrorField = (errors) => FIELD_ORDER.find((field) => errors[field])

const focusField = (field) => {
  const id = field === 'coverDish' ? 'category-cover-auto' : `category-${field}`
  document.getElementById(id)?.focus()
}

// Create (category = null) or edit form. Checks the fields, asks for confirmation, sends JSON, then goes back to the list
const CategoryForm = ({ category, dishes, nextOrder, backTo }) => {
  const { t, tError } = useLanguage()
  const navigate = useNavigate()
  const pendingFocusRef = useRef(null) // field to focus once the confirm dialog has closed
  const [options] = useState(() => coverOptions(dishes))
  const [initial] = useState(() => initialValues(category, nextOrder, options))
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({}) // field --> i18n key
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const isEdit = Boolean(category)

  const clearError = (field) => {
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    clearError(name)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    const field = firstErrorField(found)
    if (field) {
      focusField(field)
      return
    }
    setIsConfirmOpen(true)
  }

  const save = async () => {
    const body = {
      name: { it: values.nameIt.trim(), en: values.nameEn.trim() },
      order: Number(values.order.trim()),
    }
    if (isEdit && values.coverDish !== initial.coverDish) body.coverDish = values.coverDish || null // only when changed: null = automatic

    try {
      const { data } = isEdit ? await api.put(`/categories/${category._id}`, body) : await api.post('/categories', body)
      toast.success(t(isEdit ? 'categoryForm.saved' : 'categoryForm.created', { name: data.name.it }))
      navigate(backTo)
    } catch (err) {
      toast.error(tError(err))
      if (getErrorCode(err) === 'CATEGORY_NOT_FOUND') { // deleted meanwhile from another screen
        navigate(backTo)
        return
      }
      const found = serverFieldErrors(err)
      setErrors(found)
      pendingFocusRef.current = firstErrorField(found)
    }
  }

  const deleteCategory = async () => { // the saved category, not the values typed in the form
    const name = category.name.it
    try {
      await api.delete(`/categories/${category._id}`)
      toast.success(t('categoryForm.deleted', { name }))
    } catch (err) {
      toast.error(tError(err)) // 409 CATEGORY_HAS_DISHES: the server is the one that knows the current dish count
      if (getErrorCode(err) !== 'CATEGORY_NOT_FOUND') return // 404: already deleted elsewhere, the list is the right place anyway
    }
    navigate(backTo)
  }

  const handleConfirmClose = () => { // runs after the dialog has given the focus back, so this focus wins
    setIsConfirmOpen(false)
    const field = pendingFocusRef.current
    pendingFocusRef.current = null
    if (field) focusField(field)
  }

  const describedBy = (field, hasHint = false) => [
    hasHint && `category-${field}-hint`,
    errors[field] && `category-${field}-error`,
  ].filter(Boolean).join(' ') || undefined

  const fieldMessages = (field, hint) => (
    <>
      {hint && <p id={`category-${field}-hint`} className={styles.hint}>{hint}</p>}
      {errors[field] && <p id={`category-${field}-error`} className={styles.error}>{t(errors[field])}</p>}
    </>
  )

  const inputProps = (field, hasHint = false) => ({
    id: `category-${field}`,
    name: field,
    value: values[field],
    onChange: handleChange,
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': describedBy(field, hasHint),
  })

  const requiredMark = <span className={styles.requiredMark} aria-hidden="true"> *</span>

  const confirmName = values.nameIt.trim()
  const chosenDish = options.find((dish) => dish._id === values.coverDish)
  let coverNote = ''
  if (isEdit) {
    coverNote = chosenDish
      ? t('categoryForm.confirm.coverDish', { code: chosenDish.code, name: chosenDish.name.it })
      : t('categoryForm.confirm.coverAuto')
  }
  const confirmMessage = [t('categoryForm.confirm.position', { order: values.order.trim() }), coverNote].filter(Boolean).join(' ')

  const hasErrors = Object.keys(errors).length > 0
  const autoPhoto = options[0]?.image.url // what "Automatica" shows: the first dish with a photo, by code

  let coverContent
  if (!isEdit) {
    coverContent = <p className={styles.hint}>{t('categoryForm.cover.newCategory')}</p>
  } else if (options.length === 0) {
    coverContent = <p className={styles.hint}>{t('categoryForm.cover.noPhotos')}</p>
  } else {
    coverContent = (
      <div className={styles.tiles}>
        <label className={styles.tile}>
          <span className={styles.tilePhoto}>
            {autoPhoto ? <img src={thumbnailUrl(autoPhoto, TILE_THUMBNAIL)} alt="" loading="lazy" /> : <DishVisual seed={confirmName} />}
          </span>
          <span className={styles.tileText}>
            <input
              id="category-cover-auto"
              type="radio"
              name="coverDish"
              value=""
              className={styles.radio}
              checked={values.coverDish === ''}
              onChange={handleChange}
              aria-describedby="category-cover-auto-hint"
            />
            <span>
              <span className={styles.tileTitle}>{t('categoryForm.cover.auto')}</span>
              <span id="category-cover-auto-hint" className={styles.tileHint}>{t('categoryForm.cover.autoHint')}</span>
            </span>
          </span>
        </label>

        {options.map((dish) => (
          <label key={dish._id} className={styles.tile}>
            <span className={styles.tilePhoto}>
              <img src={thumbnailUrl(dish.image.url, TILE_THUMBNAIL)} alt="" loading="lazy" />
            </span>
            <span className={styles.tileText}>
              <input
                type="radio"
                name="coverDish"
                value={dish._id}
                className={styles.radio}
                checked={values.coverDish === dish._id}
                onChange={handleChange}
              />
              <span className={styles.tileTitle}>
                <span className={styles.tileCode}>{dish.code}</span> {dish.name.it}
              </span>
            </span>
          </label>
        ))}
      </div>
    )
  }

  return (
    <>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <p className={styles.legend}>{t('dishForm.requiredLegend')}</p>
        {hasErrors && <p className={styles.summary} role="alert">{t('dishForm.errorSummary')}</p>}

        <section className={styles.card} aria-labelledby="category-section-main">
          <h2 id="category-section-main" className={styles.cardTitle}>{t('categoryForm.sections.main')}</h2>
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="category-nameIt" className={styles.label}>{t('categoryForm.nameIt')}{requiredMark}</label>
              <input {...inputProps('nameIt')} className={styles.input} required lang="it" autoComplete="off" />
              {fieldMessages('nameIt')}
            </div>

            <div className={styles.field}>
              <label htmlFor="category-nameEn" className={styles.label}>{t('categoryForm.nameEn')}</label>
              <input {...inputProps('nameEn', true)} className={styles.input} lang="en" autoComplete="off" />
              {fieldMessages('nameEn', t('dishForm.nameEnHint'))}
            </div>
          </div>

          <div className={`${styles.field} ${styles.orderField}`}>
            <label htmlFor="category-order" className={styles.label}>{t('categoryForm.order')}{requiredMark}</label>
            <input
              {...inputProps('order', true)}
              className={`${styles.input} ${styles.orderInput}`}
              required
              inputMode="numeric"
              maxLength={3}
              autoComplete="off"
            />
            {fieldMessages('order', t('categoryForm.orderHint'))}
          </div>
        </section>

        <fieldset className={styles.card} aria-describedby={describedBy('coverDish', true)}>
          <legend className={styles.cardTitle}>{t('categoryForm.sections.cover')}</legend>
          {fieldMessages('coverDish', t('categoryForm.cover.hint'))}
          {coverContent}
        </fieldset>

        <div className={styles.actions}>
          {isEdit && (
            <button type="button" className={styles.delete} onClick={() => setIsDeleteOpen(true)}>
              {t('categoryForm.delete')}
            </button>
          )}
          <Link to={backTo} className={styles.cancel}>{t('confirm.cancel')}</Link>
          <button type="submit" className={styles.submit}>{t(isEdit ? 'categoryForm.save' : 'categoryForm.create')}</button>
        </div>
      </form>

      <ConfirmDialog
        open={isConfirmOpen}
        title={t(isEdit ? 'categoryForm.confirm.editTitle' : 'categoryForm.confirm.createTitle', { name: confirmName })}
        message={confirmMessage}
        confirmLabel={t(isEdit ? 'categoryForm.save' : 'categoryForm.create')}
        onConfirm={save}
        onClose={handleConfirmClose}
      />

      {isEdit && (
        <ConfirmDialog
          open={isDeleteOpen}
          destructive // red confirm button, focus starts on Annulla
          title={t('categoryForm.deleteTitle', { name: category.name.it })}
          message={category.dishCount > 0
            ? t('categoryForm.deleteMessageWithDishes', {
              dishes: category.dishCount === 1 ? t('menu.dishCountOne') : t('menu.dishCount', { count: category.dishCount }),
            })
            : t('categoryForm.deleteMessage')}
          confirmLabel={t('categoryForm.delete')}
          onConfirm={deleteCategory}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}
    </>
  )
}

export default CategoryForm
