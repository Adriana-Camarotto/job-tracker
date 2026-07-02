import { describe, it, expect } from 'vitest'
import { safeHttpUrl, safeCvDataUrl } from './url'

describe('safeHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(safeHttpUrl('https://example.com/job')).toBe('https://example.com/job')
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com/')
  })

  it('blocks javascript: URLs', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
  })

  it('blocks data: and other schemes', () => {
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeHttpUrl('vbscript:foo')).toBeNull()
    expect(safeHttpUrl('file:///etc/passwd')).toBeNull()
  })

  it('rejects garbage and empty values', () => {
    expect(safeHttpUrl('not a url')).toBeNull()
    expect(safeHttpUrl('')).toBeNull()
    expect(safeHttpUrl(null)).toBeNull()
    expect(safeHttpUrl(undefined)).toBeNull()
    expect(safeHttpUrl(42)).toBeNull()
  })

  it('trims whitespace before parsing', () => {
    expect(safeHttpUrl('  https://example.com  ')).toBe('https://example.com/')
  })
})

describe('safeCvDataUrl', () => {
  it('accepts PDF data URLs', () => {
    const url = 'data:application/pdf;base64,AAAA'
    expect(safeCvDataUrl(url)).toBe(url)
  })

  it('accepts DOCX data URLs', () => {
    const url = 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,AAAA'
    expect(safeCvDataUrl(url)).toBe(url)
  })

  it('rejects other data URLs and non-strings', () => {
    expect(safeCvDataUrl('data:text/html;base64,AAAA')).toBeNull()
    expect(safeCvDataUrl('https://example.com/cv.pdf')).toBeNull()
    expect(safeCvDataUrl(null)).toBeNull()
  })
})
