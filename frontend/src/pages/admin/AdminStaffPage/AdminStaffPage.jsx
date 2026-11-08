import { useEffect, useState } from 'react'
import api from '../../../api/client.js'
import LoadingState from '../../../components/LoadingState/LoadingState.jsx'
import Skeleton from '../../../components/Skeleton/Skeleton.jsx'
import useAuth from '../../../hooks/useAuth.js'
import useLanguage from '../../../hooks/useLanguage.js'
import initials from '../../../utils/initials.js'
import styles from './AdminStaffPage.module.css'

const SKELETON_ROWS = 4
const ROLE_TONES = { admin: styles.roleAdmin, waiter: styles.roleWaiter, kitchen: styles.roleKitchen }

// /admin/staff: read-only list of the staff accounts (they are created outside the app, no add/edit here)
const AdminStaffPage = () => {
  const { t, tError } = useLanguage()
  const { user } = useAuth()
  const [staff, setStaff] = useState(null) // null until the first answer
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false
    api.get('/users')
      .then(({ data }) => {
        if (ignore) return
        setStaff(data)
        setLoadError(null)
      })
      .catch((err) => {
        if (!ignore) setLoadError(err)
      })
    return () => {
      ignore = true
    }
  }, [attempt])

  const handleRetry = () => {
    setLoadError(null)
    setAttempt((current) => current + 1)
  }

  // Shared by the table (desktop) and the cards (phones, tablets)
  const avatar = (member) => (
    <span className={styles.avatar} aria-hidden="true">
      {member.avatar ? <img src={member.avatar} alt="" loading="lazy" width="40" height="40" /> : initials(member.name)}
    </span>
  )

  const nameBlock = (member) => (
    <>
      <span className={styles.name}>{member.name}</span>
      {member._id === user._id && <span className={styles.you}>{t('adminStaff.you')}</span>}
    </>
  )

  const role = (member) => (
    <span className={`${styles.role} ${ROLE_TONES[member.role] ?? ''}`}>{t(`staff.roles.${member.role}`)}</span>
  )

  const status = (member) => (
    <span className={member.isActive ? styles.active : styles.inactive}>
      {t(member.isActive ? 'adminStaff.active' : 'adminStaff.inactive')}
    </span>
  )

  let content
  if (!staff && loadError) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{tError(loadError)}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
      </div>
    )
  } else if (!staff) {
    content = (
      <LoadingState slowMessage="availability.slow">
        <div className={styles.skeletons}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height="4.5rem" radius="var(--radius-md)" />
          ))}
        </div>
      </LoadingState>
    )
  } else if (staff.length === 0) {
    content = <p className={styles.empty}>{t('adminStaff.empty')}</p>
  } else {
    const activeCount = staff.filter((member) => member.isActive).length

    content = (
      <>
        <p className={styles.count}>
          {t(staff.length === 1 ? 'adminStaff.countOne' : 'adminStaff.count', { count: staff.length, active: activeCount })}
        </p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">{t('adminStaff.tableLabel')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('adminStaff.columns.name')}</th>
                <th scope="col">{t('adminStaff.columns.email')}</th>
                <th scope="col">{t('adminStaff.columns.role')}</th>
                <th scope="col">{t('adminStaff.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member._id} className={member.isActive ? '' : styles.rowInactive}>
                  <th scope="row" className={styles.person}>
                    <span className={styles.personInner}>
                      {avatar(member)}
                      <span>{nameBlock(member)}</span>
                    </span>
                  </th>
                  <td className={styles.email}>{member.email}</td>
                  <td>{role(member)}</td>
                  <td>{status(member)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className={styles.cards} aria-label={t('adminStaff.tableLabel')}>
          {staff.map((member) => (
            <li key={member._id} className={`${styles.card} ${member.isActive ? '' : styles.rowInactive}`}>
              {avatar(member)}
              <div className={styles.cardBody}>
                <p>{nameBlock(member)}</p>
                <p className={styles.email}>{member.email}</p>
                <p className={styles.cardMeta}>
                  {role(member)}
                  {status(member)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <div className={styles.page}>
      <header>
        <p className={styles.kicker}>{t('adminStaff.kicker')}</p>
        <h1 className={styles.title}>{t('adminStaff.title')}</h1>
        <p className={styles.subtitle}>{t('adminStaff.subtitle')}</p>
      </header>

      {content}
    </div>
  )
}

export default AdminStaffPage
