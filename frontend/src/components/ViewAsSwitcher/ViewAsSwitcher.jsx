import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import api from '../../api/client.js'
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog.jsx'
import Icon from '../Icon/Icon.jsx'
import LoadingState from '../LoadingState/LoadingState.jsx'
import Skeleton from '../Skeleton/Skeleton.jsx'
import useAuth from '../../hooks/useAuth.js'
import useLanguage from '../../hooks/useLanguage.js'
import initials from '../../utils/initials.js'
import styles from './ViewAsSwitcher.module.css'

// Admin header: use the app as a waiter or kitchen account, to test its real permissions
const ViewAsSwitcher = () => {
  const { t, tError } = useLanguage()
  const { startViewAs } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [accounts, setAccounts] = useState(null) // null until the first answer
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [account, setAccount] = useState(null) // the one waiting for confirmation
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const panelId = useId()

  useEffect(() => { // Loaded on every opening: an account may have been deactivated meanwhile
    if (!isOpen) return undefined
    let ignore = false

    api.get('/users')
      .then(({ data }) => {
        if (ignore) return
        setAccounts(data.filter((member) => member.isActive && member.role !== 'admin'))
        setLoadError(null)
      })
      .catch((err) => {
        if (!ignore) setLoadError(err)
      })

    return () => {
      ignore = true
    }
  }, [isOpen, attempt])

  useEffect(() => { // Open list: Esc or a tap outside closes it
    if (!isOpen) return undefined

    const handleKey = (event) => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      buttonRef.current?.focus()
    }
    const handlePointer = (event) => {
      if (!wrapRef.current?.contains(event.target)) setIsOpen(false)
    }

    document.addEventListener('keydown', handleKey)
    document.addEventListener('pointerdown', handlePointer)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('pointerdown', handlePointer)
    }
  }, [isOpen])

  const handlePick = (member) => {
    setIsOpen(false)
    buttonRef.current?.focus() // the dialog gives focus back here when it closes: the row is about to be hidden
    setAccount(member)
  }

  const handleRetry = () => {
    setLoadError(null)
    setAttempt((current) => current + 1)
  }

  const handleConfirm = async () => {
    try {
      await startViewAs(account._id)
    } catch (err) {
      toast.error(tError(err))
    }
  }

  let content
  if (!accounts && loadError) {
    content = (
      <div className={styles.loadError} role="alert">
        <p>{tError(loadError)}</p>
        <button type="button" className={styles.retry} onClick={handleRetry}>{t('menu.retry')}</button>
      </div>
    )
  } else if (!accounts) {
    content = (
      <div className={styles.list}>
        <LoadingState>
          <Skeleton height="3.5rem" radius="var(--radius-lg)" />
        </LoadingState>
      </div>
    )
  } else if (accounts.length === 0) {
    content = <p className={styles.empty}>{t('viewAs.empty')}</p>
  } else {
    content = (
      <ul className={styles.list}>
        {accounts.map((member) => (
          <li key={member._id}>
            <button type="button" className={styles.row} onClick={() => handlePick(member)}>
              <span className={styles.avatar} aria-hidden="true">{initials(member.name)}</span>
              <span className={styles.text}>
                <span className={styles.name}>{member.name}</span>
                <span className={styles.email}>{member.email}</span>
              </span>
              <span className={styles.role}>{t(`staff.roles.${member.role}`)}</span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={t('viewAs.label')}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Icon name="eye" size={20} />
        <span className={styles.triggerLabel}>{t('viewAs.label')}</span>
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
          <Icon name="chevron" size={15} />
        </span>
      </button>

      <div id={panelId} className={styles.panel} hidden={!isOpen}>
        <p className={styles.title}>{t('viewAs.label')}</p>
        {content}
      </div>

      <ConfirmDialog
        open={Boolean(account)}
        title={account && t('viewAs.confirmTitle', { role: t(`staff.roles.${account.role}`), email: account.email })}
        message={account && t('viewAs.confirmMessage', { name: account.name })}
        onConfirm={handleConfirm}
        onClose={() => setAccount(null)}
      />
    </div>
  )
}

export default ViewAsSwitcher
