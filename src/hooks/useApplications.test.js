import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useApplications } from './useApplications'

describe('useApplications', () => {
  it('starts with the seed application when storage is empty', () => {
    const { result } = renderHook(() => useApplications())
    expect(result.current.apps).toHaveLength(1)
    expect(result.current.apps[0].company).toBe('Example Corp')
  })

  it('falls back to the seed data when storage is corrupted', () => {
    localStorage.setItem('job-tracker-apps', '{not valid json')
    const { result } = renderHook(() => useApplications())
    expect(result.current.apps).toHaveLength(1)
  })

  it('falls back to the seed data when storage holds a non-array', () => {
    localStorage.setItem('job-tracker-apps', '{"foo": "bar"}')
    const { result } = renderHook(() => useApplications())
    expect(result.current.apps).toHaveLength(1)
  })

  it('adds, updates and deletes applications, persisting to localStorage', () => {
    const { result } = renderHook(() => useApplications())

    act(() => result.current.addApp({ title: 'Dev', company: 'Acme', status: 'applied' }))
    expect(result.current.apps).toHaveLength(2)
    const added = result.current.apps[1]
    expect(added.id).toBeDefined()

    act(() => result.current.updateApp(added.id, { status: 'interview' }))
    expect(result.current.apps[1].status).toBe('interview')

    act(() => result.current.deleteApp(added.id))
    expect(result.current.apps).toHaveLength(1)

    const stored = JSON.parse(localStorage.getItem('job-tracker-apps'))
    expect(stored).toHaveLength(1)
  })
})
