import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIPanel from './AIPanel'

import {
  analyseJobMatch,
  generateCoverLetter,
  adaptCV,
  searchJobs,
  estimateCost,
  estimateFullApplication,
  formatCost,
} from '../services/ai'

vi.mock('../services/ai', () => ({
  analyseJobMatch: vi.fn(),
  generateCoverLetter: vi.fn(),
  adaptCV: vi.fn(),
  searchJobs: vi.fn(),
  estimateCost: vi.fn((type) => {
    const costs = {
      analyse: 0.05,
      coverLetter: 0.03,
      adaptCV: 0.04,
      search: 0.06,
    }

    return costs[type] ?? 0.01
  }),
  estimateFullApplication: vi.fn(() => 0.12),
  formatCost: vi.fn((usd) => `£${usd.toFixed(2)}`),
  COST_ESTIMATES: {
    analyse: {
      description: 'Analyse the job description',
    },
    coverLetter: {
      description: 'Generate a tailored cover letter',
    },
    adaptCV: {
      description: 'Adapt the CV to the job',
    },
    search: {
      description: 'Search for relevant jobs',
      searches: 3,
    },
  },
  PRICE_INPUT_PER_M: vi.fn(() => 2),
  PRICE_OUTPUT_PER_M: vi.fn(() => 10),
  USD_TO_GBP: 0.79,
}))

vi.mock('../utils/url', () => ({
  safeHttpUrl: vi.fn((url) => {
    if (!url) return null
    return /^https?:\/\//.test(url) ? url : null
  }),
}))

describe('AIPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('tabs', () => {
    it('shows the Analyse job tab by default', () => {
      render(<AIPanel onJobFound={vi.fn()} />)

      expect(screen.getByText('Analyse job')).toBeInTheDocument()
      expect(
        screen.getByPlaceholderText(
          'Paste the complete job description here...'
        )
      ).toBeInTheDocument()
    })

    it('switches to the Search jobs tab', async () => {
      const user = userEvent.setup()

      render(<AIPanel onJobFound={vi.fn()} />)

      await user.click(screen.getByText('Search jobs'))

      expect(
        screen.getByPlaceholderText('e.g. React developer')
      ).toBeInTheDocument()
    })
  })

  describe('analyse job', () => {
    it('disables Analyse match when there is no job description', () => {
      render(<AIPanel onJobFound={vi.fn()} />)

      expect(
        screen.getByRole('button', { name: '⚡ Analyse match' })
      ).toBeDisabled()
    })

    it('analyses the job and displays the result', async () => {
      const user = userEvent.setup()

      analyseJobMatch.mockResolvedValue({
        score: 82,
        title: 'Frontend Engineer',
        company: 'Anythink',
        location: 'Remote UK',
        summary: 'A React and TypeScript frontend role.',
        matching_skills: ['React', 'TypeScript', 'Next.js'],
        missing_skills: ['Radix'],
        strengths: [
          'Strong React experience',
          'Good TypeScript experience',
        ],
        recommendation: 'Strong match. Apply.',
      })

      render(<AIPanel onJobFound={vi.fn()} />)

      const textarea = screen.getByPlaceholderText(
        'Paste the complete job description here...'
      )

      await user.type(textarea, 'Frontend Engineer React TypeScript Next.js')

      await user.click(
        screen.getByRole('button', { name: '⚡ Analyse match' })
      )

      await waitFor(() => {
        expect(analyseJobMatch).toHaveBeenCalledWith(
          'Frontend Engineer React TypeScript Next.js'
        )
      })

      expect(screen.getByText('82')).toBeInTheDocument()
      expect(screen.getByText('Frontend Engineer')).toBeInTheDocument()
      expect(
        screen.getByText(/Anythink · Remote UK/)
      ).toBeInTheDocument()
      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.getByText('Radix')).toBeInTheDocument()
      expect(screen.getByText('Strong match. Apply.')).toBeInTheDocument()
    })

    it('shows an error when analysis fails', async () => {
      const user = userEvent.setup()

      analyseJobMatch.mockRejectedValue(
        new Error('Unable to analyse job')
      )

      render(<AIPanel onJobFound={vi.fn()} />)

      await user.type(
        screen.getByPlaceholderText(
          'Paste the complete job description here...'
        ),
        'React frontend developer'
      )

      await user.click(
        screen.getByRole('button', { name: '⚡ Analyse match' })
      )

      expect(
        await screen.findByText('⚠️ Unable to analyse job')
      ).toBeInTheDocument()
    })
  })

  describe('cover letter and CV', () => {
    async function analyseJob(user) {
      analyseJobMatch.mockResolvedValue({
        score: 80,
        title: 'Frontend Developer',
        company: 'Test Company',
        location: 'London',
        summary: 'Frontend role',
        matching_skills: ['React'],
        missing_skills: [],
        strengths: ['React experience'],
        recommendation: 'Good match',
      })

      await user.type(
        screen.getByPlaceholderText(
          'Paste the complete job description here...'
        ),
        'React frontend developer'
      )

      await user.click(
        screen.getByRole('button', { name: '⚡ Analyse match' })
      )

      await screen.findByText('Frontend Developer')
    }

    it('generates a cover letter after analysing a job', async () => {
      const user = userEvent.setup()

      generateCoverLetter.mockResolvedValue(
        'Dear Hiring Manager,\n\nI am excited to apply...'
      )

      render(<AIPanel onJobFound={vi.fn()} />)

      await analyseJob(user)

      await user.click(
        screen.getByRole('button', { name: '✉️ Cover letter' })
      )

      await waitFor(() => {
        expect(generateCoverLetter).toHaveBeenCalledWith(
          'React frontend developer',
          'Frontend Developer',
          'Test Company'
        )
      })

      expect(
        await screen.findByText(/Dear Hiring Manager/)
      ).toBeInTheDocument()
    })

    it('generates an adapted CV after analysing a job', async () => {
      const user = userEvent.setup()

      adaptCV.mockResolvedValue(
        'Frontend Developer\n\nRelevant skills:\nReact\nTypeScript'
      )

      render(<AIPanel onJobFound={vi.fn()} />)

      await analyseJob(user)

      await user.click(
        screen.getByRole('button', { name: '📄 Adapt CV' })
      )

      await waitFor(() => {
        expect(adaptCV).toHaveBeenCalledWith(
          'React frontend developer',
          'Frontend Developer',
          'Test Company'
        )
      })

      expect(
        await screen.findByText(/Relevant skills/)
      ).toBeInTheDocument()
    })
  })

  describe('add to tracker', () => {
    it('adds the analysed job to the tracker', async () => {
      const user = userEvent.setup()
      const onJobFound = vi.fn()

      analyseJobMatch.mockResolvedValue({
        score: 90,
        title: 'Senior Frontend Developer',
        company: 'Test Company',
        location: 'Remote',
        summary: 'Great role',
        matching_skills: ['React'],
        missing_skills: [],
        strengths: ['Strong frontend experience'],
        recommendation: 'Apply immediately',
      })

      render(<AIPanel onJobFound={onJobFound} />)

      await user.type(
        screen.getByPlaceholderText(
          'Paste the complete job description here...'
        ),
        'Senior frontend developer React'
      )

      await user.click(
        screen.getByRole('button', { name: '⚡ Analyse match' })
      )

      await screen.findByText('Senior Frontend Developer')

      await user.click(
        screen.getByRole('button', { name: '+ Add to tracker' })
      )

      expect(onJobFound).toHaveBeenCalledTimes(1)

      expect(onJobFound).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Senior Frontend Developer',
          company: 'Test Company',
          location: 'Remote',
          status: 'applied',
          notes: 'Apply immediately',
        })
      )

      expect(
        screen.getByPlaceholderText(
          'Paste the complete job description here...'
        )
      ).toHaveValue('')
    })
  })

  describe('cost breakdown', () => {
    it('shows the cost breakdown when requested', async () => {
      const user = userEvent.setup()

      render(<AIPanel onJobFound={vi.fn()} />)

      expect(
        screen.queryByText('Estimated cost (Claude Sonnet 5)')
      ).not.toBeInTheDocument()

      await user.click(
        screen.getByRole('button', { name: /Show cost breakdown/i })
      )

      expect(
        screen.getByText(/Estimated cost \(Claude Sonnet 5\)/)
      ).toBeInTheDocument()

      expect(
        screen.getByText(/Analyse job match only/)
      ).toBeInTheDocument()

      expect(
        screen.getByText(/Full bundle \(analyse \+ cover letter \+ adapt CV\)/)
      ).toBeInTheDocument()
    })
  })

  describe('search jobs', () => {
    it('disables Search jobs when there is no query', async () => {
      const user = userEvent.setup()

      render(<AIPanel onJobFound={vi.fn()} />)

      await user.click(screen.getByText('Search jobs'))

      expect(
        screen.getByRole('button', { name: '🔍 Search jobs' })
      ).toBeDisabled()
    })

    it('searches for jobs and displays the results', async () => {
      const user = userEvent.setup()

      searchJobs.mockResolvedValue({
        jobs: [
          {
            title: 'Frontend Developer',
            company: 'Tech Company',
            location: 'London',
            type: 'Full-time',
            posted: '2 days ago',
            verified: true,
            match_score: 88,
            description: 'React and TypeScript role.',
            url: 'https://example.com/job',
          },
        ],
        search_tips: ['Try searching for Next.js roles too'],
      })

      render(<AIPanel onJobFound={vi.fn()} />)

      await user.click(screen.getByText('Search jobs'))

      await user.type(
        screen.getByPlaceholderText('e.g. React developer'),
        'React developer'
      )

      await user.click(
        screen.getByRole('button', { name: '🔍 Search jobs' })
      )

      await waitFor(() => {
        expect(searchJobs).toHaveBeenCalledWith(
          'React developer',
          'UK',
          'week',
          5
        )
      })

      expect(
        await screen.findByText('Frontend Developer')
      ).toBeInTheDocument()

      expect(screen.getByText('Tech Company · London · Full-time'))
        .toBeInTheDocument()

      expect(screen.getByText('88%')).toBeInTheDocument()

      expect(
        screen.getByText(/Try searching for Next\.js roles too/)
      ).toBeInTheDocument()

      expect(
        screen.getByRole('link', { name: 'View job ↗' })
      ).toHaveAttribute('href', 'https://example.com/job')
    })

    it('shows an error when job search fails', async () => {
      const user = userEvent.setup()

      searchJobs.mockRejectedValue(
        new Error('Search service unavailable')
      )

      render(<AIPanel onJobFound={vi.fn()} />)

      await user.click(screen.getByText('Search jobs'))

      await user.type(
        screen.getByPlaceholderText('e.g. React developer'),
        'React developer'
      )

      await user.click(
        screen.getByRole('button', { name: '🔍 Search jobs' })
      )

      expect(
        await screen.findByText('⚠️ Search service unavailable')
      ).toBeInTheDocument()
    })

    it('shows a message when no qualifying jobs are found', async () => {
      const user = userEvent.setup()

      searchJobs.mockResolvedValue({
        jobs: [],
        search_tips: [],
      })

      render(<AIPanel onJobFound={vi.fn()} />)

      await user.click(screen.getByText('Search jobs'))

      await user.type(
        screen.getByPlaceholderText('e.g. React developer'),
        'React developer'
      )

      await user.click(
        screen.getByRole('button', { name: '🔍 Search jobs' })
      )

      expect(
        await screen.findByText(/No qualifying job adverts found/)
      ).toBeInTheDocument()
    })
  })
})