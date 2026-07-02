import { useState } from 'react'
import { safeHttpUrl, safeCvDataUrl } from '../utils/url'
import styles from './ApplicationCard.module.css'

const STATUS_CONFIG = {
  applied: { label: 'Applied', color: 'blue' },
  interview: { label: 'Interview', color: 'amber' },
  offer: { label: 'Offer', color: 'accent' },
  rejected: { label: 'Rejected', color: 'red' },
}

export default function ApplicationCard({ app, onEdit, onDelete }) {
  const [showCover, setShowCover] = useState(false)
  const s = STATUS_CONFIG[app.status] || STATUS_CONFIG.applied
  const jobLink = safeHttpUrl(app.link)
  const companyLink = safeHttpUrl(app.companyLink)
  const cvHref = safeCvDataUrl(app.cvData)

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <div className={styles.left}>
          <div className={styles.index}>{String(app.id).slice(-3).padStart(3,'0')}</div>
          <div>
            <div className={styles.title}>{app.title}</div>
            <div className={styles.company}>
              {app.company}{app.location ? <span className={styles.sep}>·</span> : null}{app.location}
            </div>
          </div>
        </div>
        <div className={styles.right}>
          <span className={`${styles.badge} ${styles[`badge_${s.color}`]}`}>{s.label}</span>
          <button className={styles.iconBtn} onClick={() => onEdit(app)} title="Edit" aria-label={`Edit application at ${app.company}`}>✎</button>
          <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => onDelete(app.id)} title="Delete" aria-label={`Delete application at ${app.company}`}>✕</button>
        </div>
      </div>

      <div className={styles.meta}>
        {app.date && <span className={styles.metaItem}>📅 {app.date}</span>}
        {jobLink && <a href={jobLink} target="_blank" rel="noopener noreferrer" className={styles.link}>Job posting ↗</a>}
        {companyLink && <a href={companyLink} target="_blank" rel="noopener noreferrer" className={styles.link}>Company ↗</a>}
        {cvHref && (
          <a
            href={cvHref}
            download={app.cvName || 'cv.pdf'}
            className={styles.link}
            title="Download CV"
          >
            📄 {app.cvName || 'CV'} ↓
          </a>
        )}
      </div>

      {app.notes && <div className={styles.notes}>{app.notes}</div>}

      {app.cover && (
        <div className={styles.coverSection}>
          <button className={styles.coverToggle} onClick={() => setShowCover(v => !v)}>
            {showCover ? '▲ Hide' : '▼ Show'} cover letter
          </button>
          {showCover && <div className={styles.coverBody}>{app.cover}</div>}
        </div>
      )}
    </div>
  )
}
