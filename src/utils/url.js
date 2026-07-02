// Only allow http/https links — blocks javascript:, data:, vbscript: etc.
// used as clickable hrefs from user input or AI output.
export function safeHttpUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href
    return null
  } catch {
    return null
  }
}

// CV attachments are stored as data: URLs — only allow the two accepted types.
const ALLOWED_CV_PREFIXES = [
  'data:application/pdf;base64,',
  'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,',
]

export function safeCvDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  return ALLOWED_CV_PREFIXES.some(p => dataUrl.startsWith(p)) ? dataUrl : null
}
