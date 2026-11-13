import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Icon from '../../../components/Icon/Icon.jsx'
import useLanguage from '../../../hooks/useLanguage.js'
import styles from './AdminQrPage.module.css'

const FILE_NAME = 'comanda-menu-qr.svg'
const LOCAL_HOSTS = ['localhost', '127.0.0.1']

// /admin/qr: the general QR code for the tables. It opens the public menu of the site it is generated on
// (the Vercel domain live, localhost in development), so the URL is never written in the code
const AdminQrPage = () => {
  const { t } = useLanguage()
  const qrRef = useRef(null)

  const menuUrl = `${window.location.origin}/menu`
  const isLocal = LOCAL_HOSTS.includes(window.location.hostname)

  const handleDownload = () => { // the same SVG as on screen, saved as a file: it scales to any size without losing quality
    const svgText = new XMLSerializer().serializeToString(qrRef.current)
    const blob = new Blob([svgText], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = FILE_NAME
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0) // after the browser has started the download
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.kicker}>{t('adminQr.kicker')}</p>
        <h1 className={styles.title}>{t('adminQr.title')}</h1>
        <p className={styles.subtitle}>{t('adminQr.subtitle')}</p>
        <p className={styles.target}>{t('adminQr.target', { url: menuUrl })}</p>
        {isLocal && <p className={styles.localNote}>{t('adminQr.localNote')}</p>}
      </header>

      <section className={styles.card} aria-label={t('adminQr.cardLabel')}>
        <QRCodeSVG
          ref={qrRef}
          value={menuUrl}
          size={320}
          level="M"
          marginSize={4} // the white border scanners need, also in the downloaded file
          title={t('adminQr.qrTitle')}
          role="img"
          className={styles.qr}
        />
        <p className={styles.name}>Comanda</p>
        <p className={styles.scan}>{t('adminQr.scan')}</p>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => window.print()} // the print rules in the CSS keep only the card
        >
          <Icon name="printer" size={20} />
          {t('adminQr.print')}
        </button>
        <button type="button" className={styles.secondary} onClick={handleDownload}>
          <Icon name="download" size={20} />
          {t('adminQr.download')}
        </button>
      </div>
    </div>
  )
}

export default AdminQrPage
