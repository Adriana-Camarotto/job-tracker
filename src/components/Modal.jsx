import { useState, useEffect, useRef } from 'react'
import styles from './Modal.module.css'

// Keep attachments well under the ~5MB localStorage quota (base64 adds ~33%)
const MAX_CV_BYTES = 3 * 1024 * 1024

const EMPTY = {
  title: '', company: '', location: '', status: 'applied',
  link: '', companyLink: '', date: new Date().toISOString().split('T')[0],
  cover: '', notes: '', cvName: '', cvData: '',
}

export default function Modal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(EMPTY)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState(null)
  const fileRef = useRef()
  const firstFieldRef = useRef()

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : { ...EMPTY, date: new Date().toISOString().split('T')[0] })
      setFileError(null)
      firstFieldRef.current?.focus()
    }
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const ALLOWED = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]

  const handleFile = (file) => {
    if (!file) return
    if (!ALLOWED.includes(file.type)) {
      setFileError('Only PDF or DOCX files are accepted.')
      return
    }
    if (file.size > MAX_CV_BYTES) {
      setFileError('File is too large — maximum 3 MB.')
      return
    }
    setFileError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      setForm(f => ({ ...f, cvName: file.name, cvData: e.target.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const removeCV = () => setForm(f => ({ ...f, cvName: '', cvData: '' }))

  const handleSave = () => {
    if (!form.title.trim() || !form.company.trim()) return
    onSave(form)
    onClose()
  }

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Application form">
        <div className={styles.header}>
          <span className={styles.title}>{initial ? 'Edit application' : 'New application'}</span>
          <button className={styles.close} onClick={onClose} aria-label="Close dialog">✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.grid2}>
            <Field label="Job title *">
              <input ref={firstFieldRef} value={form.title} onChange={set('title')} placeholder="e.g. Software Engineer" />
            </Field>
            <Field label="Company *">
              <input value={form.company} onChange={set('company')} placeholder="e.g. Example Corp" />
            </Field>
          </div>
          <div className={styles.grid2}>
            <Field label="Location">
              <input value={form.location} onChange={set('location')} placeholder="e.g. London (Hybrid)" />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={set('status')}>
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
              </select>
            </Field>
          </div>
          <div className={styles.grid2}>
            <Field label="Job posting link">
              <input value={form.link} onChange={set('link')} placeholder="https://..." type="url" />
            </Field>
            <Field label="Company page link">
              <input value={form.companyLink} onChange={set('companyLink')} placeholder="https://..." type="url" />
            </Field>
          </div>
          <Field label="Date applied">
            <input value={form.date} onChange={set('date')} type="date" style={{ maxWidth: '200px' }} />
          </Field>

          <Field label="CV / Resume (PDF)">
            {form.cvData ? (
              <div className={styles.cvAttached}>
                <span className={styles.cvIcon}>📄</span>
                <span className={styles.cvName}>{form.cvName}</span>
                <button className={styles.cvRemove} onClick={removeCV} title="Remove" aria-label="Remove attached CV">✕</button>
              </div>
            ) : (
              <div
                className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <span className={styles.dropIcon}>⬆</span>
                <span className={styles.dropText}>Drop PDF or DOCX here or <u>click to browse</u></span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
                  onChange={(e) => handleFile(e.target.files[0])}
                />
              </div>
            )}
            {fileError && <span role="alert" style={{ fontSize: '12px', color: 'var(--red)' }}>{fileError}</span>}
          </Field>

          <Field label="Cover letter">
            <textarea value={form.cover} onChange={set('cover')} placeholder="Paste or write your cover letter here..." rows={8} />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={set('notes')} placeholder="Salary range, contacts, next steps..." rows={3} />
          </Field>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={onClose}>Cancel</button>
          <button className={styles.btnSave} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  // <label> wraps its control so clicking the label focuses the field
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  )
}

