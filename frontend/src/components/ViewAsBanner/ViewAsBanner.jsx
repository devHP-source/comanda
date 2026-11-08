import Icon from '../Icon/Icon.jsx'
import useAuth from '../../hooks/useAuth.js'
import useLanguage from '../../hooks/useLanguage.js'
import styles from './ViewAsBanner.module.css'

// Always on screen while the admin uses another account, with the way back
const ViewAsBanner = () => {
  const { t } = useLanguage()
  const { user, stopViewAs } = useAuth()

  return (
    <div className={styles.banner} role="status">
      <span className={styles.icon}><Icon name="eye" size={18} /></span>
      <p className={styles.text}>
        <span className={styles.lead}>{t('viewAs.lead')}</span>{' '}
        <span className={styles.account}>
          <strong>{t(`staff.roles.${user.role}`)}</strong> ({user.email})
        </span>
      </p>
      <button type="button" className={styles.back} onClick={stopViewAs}>{t('viewAs.back')}</button>
    </div>
  )
}

export default ViewAsBanner
