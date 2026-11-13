import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import api, { getErrorCode } from '../../api/client.js'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx'
import DishVisual from '../DishVisual/DishVisual.jsx'
import useLanguage from '../../hooks/useLanguage.js'
import ALLERGENS from '../../utils/allergens.js'
import { parsePriceInput, toPriceInput } from '../../utils/priceInput.js'
import thumbnailUrl from '../../utils/thumbnailUrl.js'
import styles from './DishForm.module.css'

const CODE_PATTERN = /^[A-Za-z0-9]{1,8}$/ // "47", "1a", "15g", "P12"
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] // same list and limit as the upload middleware
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const SPICE_LEVELS = ['0', '1', '2', '3']
const FLAGS = ['isPublished', 'isAvailable', 'isFeatured', 'isVegetarian', 'isFrozen']
const FIELD_ORDER = ['code', 'category', 'price', 'nameIt', 'nameEn', 'descriptionIt', 'descriptionEn', 'spiceLevel', 'allergens', 'image', ...FLAGS] // the first field with an error gets the focus

// Server validation paths ("name.it", "allergens.0") --> form fields
const SERVER_FIELDS = {
  code: 'code',
  category: 'category',
  price: 'price',
  'name.it': 'nameIt',
  'name.en': 'nameEn',
  'description.it': 'descriptionIt',
  'description.en': 'descriptionEn',
  spiceLevel: 'spiceLevel',
  allergens: 'allergens',
  ...Object.fromEntries(FLAGS.map((flag) => [flag, flag])),
}
const FIELD_MESSAGES = { // i18n key shown under each field; other fields get the generic one
  code: 'dishForm.errors.code',
  category: 'dishForm.errors.category',
  price: 'dishForm.errors.price',
  nameIt: 'dishForm.errors.nameIt',
  spiceLevel: 'dishForm.errors.spiceLevel',
  allergens: 'dishForm.errors.allergens',
}
const IMAGE_ERROR_CODES = ['INVALID_IMAGE_TYPE', 'IMAGE_TOO_LARGE', 'INVALID_UPLOAD', 'IMAGE_UPLOAD_FAILED']

const initialValues = (dish) => ({ // a new dish starts published and available
  code: dish?.code ?? '',
  category: dish?.category ?? '',
  price: dish ? toPriceInput(dish.price) : '',
  nameIt: dish?.name.it ?? '',
  nameEn: dish?.name.en ?? '',
  descriptionIt: dish?.description?.it ?? '',
  descriptionEn: dish?.description?.en ?? '',
  spiceLevel: String(dish?.spiceLevel ?? 0),
  allergens: dish?.allergens ?? [],
  isPublished: dish?.isPublished ?? true,
  isAvailable: dish?.isAvailable ?? true,
  isFeatured: dish?.isFeatured ?? false,
  isVegetarian: dish?.isVegetarian ?? false,
  isFrozen: dish?.isFrozen ?? false,
})

const validate = (values) => { // same rules as the server, checked before the confirm dialog
  const errors = {}
  if (!CODE_PATTERN.test(values.code.trim())) errors.code = FIELD_MESSAGES.code
  if (!values.category) errors.category = FIELD_MESSAGES.category
  if (parsePriceInput(values.price) === null) errors.price = FIELD_MESSAGES.price
  if (!values.nameIt.trim()) errors.nameIt = FIELD_MESSAGES.nameIt
  return errors
}

const serverFieldErrors = (err) => { // a failed save --> messages under the fields concerned
  const code = getErrorCode(err)
  if (code === 'DUPLICATE_KEY') return { code: 'dishForm.errors.codeTaken' } // code is the only unique field of a dish
  if (code === 'INVALID_CATEGORY') return { category: FIELD_MESSAGES.category }
  if (IMAGE_ERROR_CODES.includes(code)) return { image: `errors.${code}` }
  if (code !== 'VALIDATION_FAILED') return {}

  const errors = {}
  for (const path of Object.keys(err.response.data.errors ?? {})) {
    const field = SERVER_FIELDS[path] ?? SERVER_FIELDS[path.split('.')[0]]
    if (field) errors[field] = FIELD_MESSAGES[field] ?? 'dishForm.errors.invalid'
  }
  return errors
}

const firstErrorField = (errors) => FIELD_ORDER.find((field) => errors[field])

const focusField = (field) => { // allergens: the first checkbox; image: the "choose photo" button
  const id = field === 'allergens' ? `dish-allergen-${ALLERGENS[0]}` : `dish-${field}`
  document.getElementById(id)?.focus()
}

const buildFormData = (values, imageFile, removeImage) => { // multipart: the server reads "name[it]" as name.it and repeated "allergens" as a list
  const data = new FormData()
  data.append('code', values.code.trim())
  data.append('category', values.category)
  data.append('price', String(parsePriceInput(values.price))) // "5,60" --> "5.6"
  data.append('name[it]', values.nameIt.trim())
  data.append('name[en]', values.nameEn.trim())
  data.append('description[it]', values.descriptionIt.trim())
  data.append('description[en]', values.descriptionEn.trim())
  data.append('spiceLevel', values.spiceLevel)
  if (values.allergens.length === 0) data.append('allergens', '') // an empty list can't travel in multipart: "" means none
  for (const allergen of values.allergens) data.append('allergens', allergen)
  for (const flag of FLAGS) data.append(flag, String(values[flag]))
  if (imageFile) data.append('image', imageFile)
  else if (removeImage) data.append('removeImage', 'true')
  return data
}

// Create (dish = null) or edit form. Checks the fields, asks for confirmation, sends multipart, then goes back to the list
const DishForm = ({ dish, categories, backTo }) => {
  const { t, pick, tError } = useLanguage()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const pendingFocusRef = useRef(null) // field to focus once the confirm dialog has closed
  const [values, setValues] = useState(() => initialValues(dish))
  const [errors, setErrors] = useState({}) // field --> i18n key
  const [image, setImage] = useState(null) // new photo not saved yet: { file, previewUrl }
  const [removeImage, setRemoveImage] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const isEdit = Boolean(dish)
  const currentImageUrl = dish?.image?.url || ''

  useEffect(() => { // frees the preview of the replaced (or last) chosen photo
    if (!image) return
    return () => URL.revokeObjectURL(image.previewUrl)
  }, [image])

  const clearError = (field) => {
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
    clearError(name)
  }

  const toggleAllergen = (allergen) => {
    setValues((current) => ({
      ...current,
      allergens: current.allergens.includes(allergen)
        ? current.allergens.filter((item) => item !== allergen)
        : ALLERGENS.filter((item) => item === allergen || current.allergens.includes(item)), // keeps the EU list order
    }))
    clearError('allergens')
  }

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    event.target.value = '' // picking the same file again still fires "change"
    if (!file) return

    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) { // checked here too: no waiting for an upload that will fail
      setErrors((current) => ({ ...current, image: file.size > MAX_IMAGE_BYTES ? 'errors.IMAGE_TOO_LARGE' : 'errors.INVALID_IMAGE_TYPE' }))
      return
    }
    setImage({ file, previewUrl: URL.createObjectURL(file) })
    setRemoveImage(false)
    clearError('image')
  }

  const handleRemoveImage = () => {
    if (image) setImage(null) // drop the new photo: back to the saved one (if any)
    else setRemoveImage(true)
    clearError('image')
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
    const body = buildFormData(values, image?.file, removeImage)
    try {
      const { data } = isEdit ? await api.put(`/dishes/${dish._id}`, body) : await api.post('/dishes', body)
      toast.success(t(isEdit ? 'dishForm.saved' : 'dishForm.created', { code: data.code, name: data.name.it }))
      navigate(backTo)
    } catch (err) {
      toast.error(tError(err))
      if (getErrorCode(err) === 'DISH_NOT_FOUND') { // deleted meanwhile from another screen
        navigate(backTo)
        return
      }
      const found = serverFieldErrors(err)
      setErrors(found)
      pendingFocusRef.current = firstErrorField(found)
    }
  }

  const deleteDish = async () => { // the saved dish, not the values typed in the form
    const names = { code: dish.code, name: dish.name.it }
    try {
      await api.delete(`/dishes/${dish._id}`)
      toast.success(t('dishForm.deleted', names))
    } catch (err) {
      toast.error(tError(err))
      if (getErrorCode(err) !== 'DISH_NOT_FOUND') return // 404: already deleted elsewhere, the list is the right place anyway
    }
    navigate(backTo) // the list reloads; if this was the last dish of its page, it moves to the page before
  }

  const handleConfirmClose = () => { // runs after the dialog has given the focus back, so this focus wins
    setIsConfirmOpen(false)
    const field = pendingFocusRef.current
    pendingFocusRef.current = null
    if (field) focusField(field)
  }

  const describedBy = (field, hasHint = false) => [
    hasHint && `dish-${field}-hint`,
    errors[field] && `dish-${field}-error`,
  ].filter(Boolean).join(' ') || undefined

  const fieldMessages = (field, hint) => (
    <>
      {hint && <p id={`dish-${field}-hint`} className={styles.hint}>{hint}</p>}
      {errors[field] && <p id={`dish-${field}-error`} className={styles.error}>{t(errors[field])}</p>}
    </>
  )

  const inputProps = (field, hasHint = false) => ({
    id: `dish-${field}`,
    name: field,
    value: values[field],
    onChange: handleChange,
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': describedBy(field, hasHint),
  })

  const requiredMark = <span className={styles.requiredMark} aria-hidden="true"> *</span>

  let previewSrc = null
  if (image) previewSrc = image.previewUrl
  else if (currentImageUrl && !removeImage) previewSrc = thumbnailUrl(currentImageUrl)

  let photoStatus = 'dishForm.photo.none'
  if (image) photoStatus = 'dishForm.photo.new'
  else if (removeImage) photoStatus = 'dishForm.photo.removed'
  else if (currentImageUrl) photoStatus = 'dishForm.photo.current'

  const confirmName = values.nameIt.trim()
  const confirmCode = values.code.trim()
  let photoNote = ''
  if (image) photoNote = t(currentImageUrl ? 'dishForm.confirm.photoReplace' : 'dishForm.confirm.photoNew')
  else if (removeImage) photoNote = t('dishForm.confirm.photoRemove')
  const confirmMessage = [
    t(values.isPublished ? 'dishForm.confirm.published' : 'dishForm.confirm.unpublished'),
    photoNote,
  ].filter(Boolean).join(' ')

  const hasErrors = Object.keys(errors).length > 0

  return (
    <>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <p className={styles.legend}>{t('dishForm.requiredLegend')}</p>
        {hasErrors && <p className={styles.summary} role="alert">{t('dishForm.errorSummary')}</p>}

        <div className={styles.columns}>
          <div className={styles.column}>
            <section className={styles.card} aria-labelledby="dish-section-main">
              <h2 id="dish-section-main" className={styles.cardTitle}>{t('dishForm.sections.main')}</h2>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="dish-code" className={styles.label}>{t('dishForm.code')}{requiredMark}</label>
                  <input
                    {...inputProps('code', true)}
                    className={`${styles.input} ${styles.codeInput}`}
                    required
                    maxLength={8}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {fieldMessages('code', t('dishForm.codeHint'))}
                </div>

                <div className={styles.field}>
                  <label htmlFor="dish-price" className={styles.label}>{t('dishForm.price')}{requiredMark}</label>
                  <div className={styles.priceWrap}>
                    <input
                      {...inputProps('price', true)}
                      className={`${styles.input} ${styles.priceInput}`}
                      required
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0,00"
                    />
                    <span className={styles.priceSuffix} aria-hidden="true">€</span>
                  </div>
                  {fieldMessages('price', t('dishForm.priceHint'))}
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="dish-category" className={styles.label}>{t('dishForm.category')}{requiredMark}</label>
                <select {...inputProps('category')} className={styles.input} required>
                  <option value="" disabled>{t('dishForm.categoryPlaceholder')}</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>{pick(category.name)}</option>
                  ))}
                </select>
                {fieldMessages('category')}
              </div>

              <div className={styles.field}>
                <label htmlFor="dish-spiceLevel" className={styles.label}>{t('dishForm.spiceLevel')}</label>
                <select {...inputProps('spiceLevel')} className={styles.input}>
                  {SPICE_LEVELS.map((level) => (
                    <option key={level} value={level}>{t(`dishForm.spice.${level}`)}</option>
                  ))}
                </select>
                {fieldMessages('spiceLevel')}
              </div>
            </section>

            <section className={styles.card} aria-labelledby="dish-section-texts">
              <h2 id="dish-section-texts" className={styles.cardTitle}>{t('dishForm.sections.texts')}</h2>
              <div className={styles.field}>
                <label htmlFor="dish-nameIt" className={styles.label}>{t('dishForm.nameIt')}{requiredMark}</label>
                <input {...inputProps('nameIt')} className={styles.input} required lang="it" autoComplete="off" />
                {fieldMessages('nameIt')}
              </div>

              <div className={styles.field}>
                <label htmlFor="dish-nameEn" className={styles.label}>{t('dishForm.nameEn')}</label>
                <input {...inputProps('nameEn', true)} className={styles.input} lang="en" autoComplete="off" />
                {fieldMessages('nameEn', t('dishForm.nameEnHint'))}
              </div>

              <div className={styles.field}>
                <label htmlFor="dish-descriptionIt" className={styles.label}>{t('dishForm.descriptionIt')}</label>
                <textarea {...inputProps('descriptionIt')} className={`${styles.input} ${styles.textarea}`} rows={3} lang="it" />
                {fieldMessages('descriptionIt')}
              </div>

              <div className={styles.field}>
                <label htmlFor="dish-descriptionEn" className={styles.label}>{t('dishForm.descriptionEn')}</label>
                <textarea {...inputProps('descriptionEn')} className={`${styles.input} ${styles.textarea}`} rows={3} lang="en" />
                {fieldMessages('descriptionEn')}
              </div>
            </section>

            <fieldset className={styles.card} aria-describedby={describedBy('allergens', true)}>
              <legend className={styles.cardTitle}>{t('dishForm.sections.allergens')}</legend>
              {fieldMessages('allergens', t('dishForm.allergensHint'))}
              <div className={styles.checkGrid}>
                {ALLERGENS.map((allergen) => (
                  <label key={allergen} className={styles.check}>
                    <input
                      id={`dish-allergen-${allergen}`}
                      type="checkbox"
                      className={styles.checkbox}
                      checked={values.allergens.includes(allergen)}
                      onChange={() => toggleAllergen(allergen)}
                    />
                    <span className={styles.checkLabel}>{t(`allergens.${allergen}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className={styles.column}>
            <section className={styles.card} aria-labelledby="dish-section-photo">
              <h2 id="dish-section-photo" className={styles.cardTitle}>{t('dishForm.sections.photo')}</h2>
              <div className={styles.preview}>
                {previewSrc ? (
                  <img src={previewSrc} alt={t('dishForm.photo.alt', { name: confirmName || confirmCode })} />
                ) : (
                  <DishVisual seed={confirmCode} />
                )}
              </div>
              <p className={styles.photoStatus} aria-live="polite">{t(photoStatus)}</p>

              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGE_TYPES.join(',')}
                className="visually-hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={handleFileChange}
              />
              <div className={styles.photoActions}>
                <button
                  id="dish-image"
                  type="button"
                  className={styles.secondary}
                  aria-describedby={describedBy('image', true)}
                  onClick={() => fileInputRef.current.click()}
                >
                  {t(previewSrc ? 'dishForm.photo.replace' : 'dishForm.photo.choose')}
                </button>
                {previewSrc && (
                  <button type="button" className={styles.quiet} onClick={handleRemoveImage}>
                    {t(image ? 'dishForm.photo.discard' : 'dishForm.photo.remove')}
                  </button>
                )}
                {removeImage && (
                  <button type="button" className={styles.quiet} onClick={() => setRemoveImage(false)}>
                    {t('dishForm.photo.restore')}
                  </button>
                )}
              </div>
              {fieldMessages('image', t('dishForm.photo.hint'))}
            </section>

            <fieldset className={styles.card}>
              <legend className={styles.cardTitle}>{t('dishForm.sections.flags')}</legend>
              <div className={styles.flags}>
                {FLAGS.map((flag) => (
                  <label key={flag} className={styles.flag}>
                    <input
                      id={`dish-${flag}`}
                      name={flag}
                      type="checkbox"
                      className={styles.checkbox}
                      checked={values[flag]}
                      onChange={handleChange}
                      aria-describedby={`dish-${flag}-hint`}
                    />
                    <span className={styles.flagText}>
                      <span className={styles.checkLabel}>{t(`dishForm.flags.${flag}`)}</span>
                      <span id={`dish-${flag}-hint`} className={styles.hint}>{t(`dishForm.flags.${flag}Hint`)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        <div className={styles.actions}>
          {isEdit && (
            <button type="button" className={styles.delete} onClick={() => setIsDeleteOpen(true)}>
              {t('dishForm.delete')}
            </button>
          )}
          <Link to={backTo} className={styles.cancel}>{t('confirm.cancel')}</Link>
          <button type="submit" className={styles.submit}>{t(isEdit ? 'dishForm.save' : 'dishForm.create')}</button>
        </div>
      </form>

      <ConfirmDialog
        open={isConfirmOpen}
        title={t(isEdit ? 'dishForm.confirm.editTitle' : 'dishForm.confirm.createTitle', { code: confirmCode, name: confirmName })}
        message={confirmMessage}
        confirmLabel={t(isEdit ? 'dishForm.save' : 'dishForm.create')}
        onConfirm={save}
        onClose={handleConfirmClose}
      />

      {isEdit && (
        <ConfirmDialog
          open={isDeleteOpen}
          destructive // red confirm button, focus starts on Annulla
          title={t('dishForm.deleteTitle', { code: dish.code, name: dish.name.it })}
          message={t('dishForm.deleteMessage')}
          confirmLabel={t('dishForm.delete')}
          onConfirm={deleteDish}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}
    </>
  )
}

export default DishForm
