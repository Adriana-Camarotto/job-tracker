import { useState } from 'react'
import { useApplications } from './hooks/useApplications'
import ApplicationCard from './components/ApplicationCard'
import Modal from './components/Modal'
import AIPanel from './components/AIPanel'
import styles from './App.module.css'

export default function App() {
  const { apps, addApp, updateApp, deleteApp } = useApplications()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')

  const stats = {
    total: apps.length,
    applied: apps.filter(a => a.status === 'applied').length,
    interview: apps.filter(a => a.status === 'interview').length,
    offer: apps.filter(a => a.status === 'offer').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
  }

  const filtered = filter === 'all' ? apps : apps.filter(a => a.status === filter)

  const handleEdit = (app) => { setEditing(app); setModalOpen(true) }
  const handleDelete = (id) => {
    const app = apps.find(a => a.id === id)
    if (window.confirm(`Delete the application${app ? ` at ${app.company}` : ''}? This cannot be undone.`)) {
      deleteApp(id)
    }
  }
  const handleClose = () => { setEditing(null); setModalOpen(false) }
  const handleSave = (form) => {
    if (editing) updateApp(editing.id, form)
    else addApp(form)
  }
  const handleJobFound = (jobData) => {
    addApp(jobData)
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <h1 className={styles.wordmark}>Job Tracker</h1>
            <p className={styles.subtitle}>Your application pipeline</p>
          </div>
          <button className={styles.addBtn} onClick={() => setModalOpen(true)}>
            + New application
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <AIPanel onJobFound={handleJobFound} />
        <div className={styles.statsRow}>
          {[
            { key: 'all', label: 'Total', value: stats.total },
            { key: 'applied', label: 'Applied', value: stats.applied },
            { key: 'interview', label: 'Interview', value: stats.interview },
            { key: 'offer', label: 'Offer', value: stats.offer },
            { key: 'rejected', label: 'Rejected', value: stats.rejected },
          ].map(s => (
            <button
              key={s.key}
              className={`${styles.statCard} ${filter === s.key ? styles.statActive : ''}`}
              onClick={() => setFilter(s.key)}
            >
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            {filter === 'all'
              ? 'No applications yet. Add your first one!'
              : `No applications with status "${filter}".`}
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(app => (
              <ApplicationCard
                key={app.id}
                app={app}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <Modal
        open={modalOpen}
        onClose={handleClose}
        onSave={handleSave}
        initial={editing}
      />
    </div>
  )
}
