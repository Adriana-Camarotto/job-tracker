import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  it('renders the header and the seeded application', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Job Tracker' })).toBeInTheDocument()
    expect(screen.getByText(/Example Corp/)).toBeInTheDocument()
  })

  it('filters applications by status', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /offer/i }))
    expect(screen.getByText(/No applications with status "offer"/)).toBeInTheDocument()
  })

  it('asks for confirmation before deleting', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /delete application/i }))
    expect(confirmSpy).toHaveBeenCalled()
    // Declined — the application is still there
    expect(screen.getByText(/Example Corp/)).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('opens the new-application modal', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /new application/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
