import { Link } from 'react-router'
import useDocumentTitle from '../../../hooks/useDocumentTitle.js'
import useLanguage from '../../../hooks/useLanguage.js'
import styles from './NotFoundPage.module.css'

const NotFoundPage = () => {
  const { t } = useLanguage()
  useDocumentTitle(t('notFound.title'))

  return (
    <section className={styles.page}>
      <p className={styles.kicker}>404</p>
      <h1 className={styles.title}>{t('notFound.title')}</h1>
      <p className={styles.text}>{t('notFound.text')}</p>
      <Link to="/menu" className={styles.action}>
        {t('notFound.backToMenu')}
      </Link>
    </section>
  )
}

export default NotFoundPage
