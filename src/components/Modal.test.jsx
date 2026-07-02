import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<Modal open={false} onClose={() => {}} onSave={() => {}} initial={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('does not save without required title and company', async () => {
    const onSave = vi.fn()
    render(<Modal open onClose={() => {}} onSave={onSave} initial={null} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves when title and company are filled', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} onSave={onSave} initial={null} />)

    await userEvent.type(screen.getByLabelText(/job title/i), 'Frontend Developer')
    await userEvent.type(screen.getByLabelText('Company *'), 'Acme')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Frontend Developer', company: 'Acme' }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} onSave={() => {}} initial={null} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('rejects oversized CV files', async () => {
    render(<Modal open onClose={() => {}} onSave={() => {}} initial={null} />)
    const input = document.querySelector('input[type="file"]')
    const bigFile = new File([new ArrayBuffer(4 * 1024 * 1024)], 'cv.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [bigFile] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i)
  })

  it('rejects disallowed file types', async () => {
    render(<Modal open onClose={() => {}} onSave={() => {}} initial={null} />)
    const input = document.querySelector('input[type="file"]')
    const exe = new File(['x'], 'virus.exe', { type: 'application/x-msdownload' })
    fireEvent.change(input, { target: { files: [exe] } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/only pdf or docx/i)
  })

  it('pre-fills the form when editing', () => {
    const initial = { title: 'Dev', company: 'Acme', location: '', status: 'applied', link: '', companyLink: '', date: '2026-07-01', cover: '', notes: '', cvName: '', cvData: '' }
    render(<Modal open onClose={() => {}} onSave={() => {}} initial={initial} />)
    expect(screen.getByLabelText(/job title/i)).toHaveValue('Dev')
    expect(screen.getByText('Edit application')).toBeInTheDocument()
  })
})
