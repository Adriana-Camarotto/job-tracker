import { useState, useEffect } from 'react'

const INITIAL_APPS = [
  {
    id: 1,
    title: 'Frontend Developer (React / TypeScript)',
    company: 'Example Corp',
    location: 'Cambridge (Hybrid)',
    status: 'applied',
    link: 'https://example.com/jobs/frontend-developer',
    companyLink: 'https://example.com',
    date: new Date().toISOString().split('T')[0],
    cover: '',
    notes: 'Sample entry — edit or delete me.',
  },
]

export function useApplications() {
  const [apps, setApps] = useState(() => {
    try {
      const stored = localStorage.getItem('job-tracker-apps')
      const parsed = stored ? JSON.parse(stored) : null
      return Array.isArray(parsed) ? parsed : INITIAL_APPS
    } catch {
      return INITIAL_APPS
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('job-tracker-apps', JSON.stringify(apps))
    } catch {
      // Quota exceeded (usually a large CV attachment) — keep the app running;
      // the in-memory state is still intact.
      console.warn('Could not persist applications: storage quota exceeded')
    }
  }, [apps])

  const addApp = (app) => setApps(prev => [...prev, { ...app, id: Date.now() }])

  const updateApp = (id, updated) =>
    setApps(prev => prev.map(a => (a.id === id ? { ...a, ...updated } : a)))

  const deleteApp = (id) => setApps(prev => prev.filter(a => a.id !== id))

  return { apps, addApp, updateApp, deleteApp }
}
