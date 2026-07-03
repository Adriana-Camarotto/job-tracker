import { useState } from 'react'
import {
  analyseJobMatch, generateCoverLetter, adaptCV, searchJobs,
  estimateCost, estimateFullApplication, formatCost, COST_ESTIMATES,
  PRICE_INPUT_PER_M, PRICE_OUTPUT_PER_M, USD_TO_GBP,
} from '../services/ai'
import { safeHttpUrl } from '../utils/url'
import styles from './AIPanel.module.css'

// ─── Cost Badge ───────────────────────────────────────────────────────────────
function CostBadge({ usd, label }) {
  return (
    <span className={styles.costBadge} title={label}>
      ~{formatCost(usd)}
    </span>
  )
}

// ─── Cost Info Box ────────────────────────────────────────────────────────────
function CostInfoBox({ operations, cheapest }) {
  return (
    <div className={styles.costBox}>
      <div className={styles.costBoxTitle}>💰 Estimated cost (Claude Sonnet 5)</div>
      <div className={styles.costRows}>
        {operations.map(op => (
          <div key={op.key} className={`${styles.costRow} ${cheapest === op.key ? styles.costRowCheapest : ''}`}>
            <div>
              <span className={styles.costOpLabel}>{op.label}</span>
              {cheapest === op.key && <span className={styles.cheapestTag}>cheapest</span>}
              <div className={styles.costOpDesc}>{op.desc}</div>
            </div>
            <span className={styles.costValue}>{formatCost(op.cost)}</span>
          </div>
        ))}
      </div>
      <div className={styles.costNote}>
        Anthropic bills in USD: ${PRICE_INPUT_PER_M()}/M input + ${PRICE_OUTPUT_PER_M()}/M output tokens
        {PRICE_INPUT_PER_M() === 2 ? ' (Sonnet 5 introductory pricing until 31 Aug 2026)' : ''},
        plus $0.01 per web search. Shown in GBP at $1 ≈ £{USD_TO_GBP}. Actual usage may vary slightly.
      </div>
    </div>
  )
}

// ─── Analyse Tab ──────────────────────────────────────────────────────────────
function AnalyseTab({ onJobFound }) {
  const [jobText, setJobText] = useState('')
  const [jobUrl, setJobUrl] = useState('')
  const [loading, setLoading] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [coverLetter, setCoverLetter] = useState(null)
  const [adaptedCV, setAdaptedCV] = useState(null)
  const [showCosts, setShowCosts] = useState(false)

  const analyseCost = estimateCost('analyse')
  const coverCost = estimateCost('coverLetter')
  const cvCost = estimateCost('adaptCV')
  const fullCost = estimateFullApplication()

  const costOps = [
    { key: 'analyse', label: 'Analyse job match only', cost: analyseCost, desc: COST_ESTIMATES.analyse.description },
    { key: 'coverLetter', label: 'Cover letter only', cost: coverCost, desc: COST_ESTIMATES.coverLetter.description },
    { key: 'adaptCV', label: 'Adapt CV only', cost: cvCost, desc: COST_ESTIMATES.adaptCV.description },
    { key: 'full', label: 'Full bundle (analyse + cover letter + adapt CV)', cost: fullCost, desc: 'All three operations in one application' },
  ]
  const cheapestKey = costOps.reduce((a, b) => a.cost < b.cost ? a : b).key

  const reset = () => { setResult(null); setCoverLetter(null); setAdaptedCV(null); setError(null) }

  const handleAnalyse = async () => {
    if (!jobText.trim()) return
    reset()
    setLoading('analyse')
    try { setResult(await analyseJobMatch(jobText)) }
    catch (e) { setError(e.message) }
    finally { setLoading(null) }
  }

  const handleCoverLetter = async () => {
    if (!result) return
    setLoading('cover')
    try { setCoverLetter(await generateCoverLetter(jobText, result.title, result.company)) }
    catch (e) { setError(e.message) }
    finally { setLoading(null) }
  }

  const handleAdaptCV = async () => {
    if (!result) return
    setLoading('cv')
    try { setAdaptedCV(await adaptCV(jobText, result.title, result.company)) }
    catch (e) { setError(e.message) }
    finally { setLoading(null) }
  }

  const handleAddToTracker = () => {
    if (!result) return
    onJobFound({
      title: result.title || '',
      company: result.company || '',
      location: result.location || '',
      status: 'applied',
      link: jobUrl || '',
      companyLink: '',
      date: new Date().toISOString().split('T')[0],
      cover: coverLetter || '',
      notes: result.recommendation || '',
    })
    setJobText('')
    setJobUrl('')
    reset()
  }

  const scoreClass = (s) => s >= 75 ? styles.scoreHigh : s >= 50 ? styles.scoreMid : styles.scoreLow

  return (
    <div className={styles.body}>
      {/* Cost toggle */}
      <button className={styles.costToggle} onClick={() => setShowCosts(v => !v)}>
        💰 {showCosts ? 'Hide' : 'Show'} cost breakdown
        <span className={styles.costPreview}>Full bundle ~{formatCost(fullCost)} per application</span>
      </button>

      {showCosts && <CostInfoBox operations={costOps} cheapest={cheapestKey} />}

      <div className={styles.field}>
        <label>Job URL (optional)</label>
        <input value={jobUrl} onChange={e => setJobUrl(e.target.value)} placeholder="https://linkedin.com/jobs/..." />
      </div>
      <div className={styles.field}>
        <label>Paste the full job description *</label>
        <textarea
          value={jobText}
          onChange={e => setJobText(e.target.value)}
          placeholder="Paste the complete job description here..."
          rows={7}
        />
      </div>

      <div className={styles.actionRowTop}>
        <button className={styles.btnPrimary} onClick={handleAnalyse} disabled={!jobText.trim() || !!loading}>
          {loading === 'analyse' ? '⏳ Analysing...' : '⚡ Analyse match'}
        </button>
        <CostBadge usd={analyseCost} label="Cost to analyse this job" />
      </div>

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {result && (
        <div className={styles.results}>
          <div className={styles.scoreRow}>
            <div className={`${styles.score} ${scoreClass(result.score)}`}>
              <span className={styles.scoreNum}>{result.score}</span>
              <span className={styles.scoreLabel}>match</span>
            </div>
            <div className={styles.jobMeta}>
              <div className={styles.jobTitle}>{result.title}</div>
              <div className={styles.jobCompany}>{result.company}{result.location ? ` · ${result.location}` : ''}</div>
              <div className={styles.jobSummary}>{result.summary}</div>
            </div>
          </div>

          <div className={styles.grid2}>
            <div>
              <div className={styles.sectionLabel}>✅ Matching skills</div>
              <div className={styles.pills}>
                {result.matching_skills?.map(s => <span key={s} className={styles.pillGreen}>{s}</span>)}
              </div>
            </div>
            <div>
              <div className={styles.sectionLabel}>⚠️ Gaps</div>
              <div className={styles.pills}>
                {result.missing_skills?.map(s => <span key={s} className={styles.pillAmber}>{s}</span>)}
              </div>
            </div>
          </div>

          {result.strengths?.length > 0 && (
            <div>
              <div className={styles.sectionLabel}>💪 Strengths for this role</div>
              <ul className={styles.list}>
                {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {result.recommendation && <div className={styles.recommendation}>{result.recommendation}</div>}

          <div className={styles.actionRow}>
            <div className={styles.actionGroup}>
              <button className={styles.btnSecondary} onClick={handleCoverLetter} disabled={!!loading}>
                {loading === 'cover' ? '⏳ Writing...' : '✉️ Cover letter'}
              </button>
              <CostBadge usd={coverCost} label="Cost to generate cover letter" />
            </div>
            <div className={styles.actionGroup}>
              <button className={styles.btnSecondary} onClick={handleAdaptCV} disabled={!!loading}>
                {loading === 'cv' ? '⏳ Adapting...' : '📄 Adapt CV'}
              </button>
              <CostBadge usd={cvCost} label="Cost to adapt CV" />
            </div>
            <button className={styles.btnAccent} onClick={handleAddToTracker}>+ Add to tracker</button>
          </div>

          {coverLetter && (
            <div className={styles.outputBlock}>
              <div className={styles.outputHeader}>
                <span>✉️ Cover letter</span>
                <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(coverLetter)}>Copy</button>
              </div>
              <pre className={styles.outputText}>{coverLetter}</pre>
            </div>
          )}

          {adaptedCV && (
            <div className={styles.outputBlock}>
              <div className={styles.outputHeader}>
                <span>📄 Adapted CV</span>
                <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(adaptedCV)}>Copy</button>
              </div>
              <pre className={styles.outputText}>{adaptedCV}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Search Tab ───────────────────────────────────────────────────────────────
function SearchTab() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('UK')
  const [timeFilter, setTimeFilter] = useState('week')
  const [limit, setLimit] = useState(5)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [showCosts, setShowCosts] = useState(false)

  // One search call runs up to 3 live web searches regardless of result count,
  // so the cost is roughly flat per search.
  const searchCost = estimateCost('search', 1)

  const costOps = [
    {
      key: 'search',
      label: 'Job search (live web search)',
      cost: searchCost,
      desc: `${COST_ESTIMATES.search.description} Includes up to ${COST_ESTIMATES.search.searches} web searches at $0.01 each.`,
    },
  ]
  const cheapestKey = 'search'

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults(null)
    try { setResults(await searchJobs(query, location, timeFilter, limit)) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const scoreClass = (s) => s >= 75 ? styles.scoreHigh : s >= 50 ? styles.scoreMid : styles.scoreLow

  return (
    <div className={styles.body}>
      <button className={styles.costToggle} onClick={() => setShowCosts(v => !v)}>
        💰 {showCosts ? 'Hide' : 'Show'} cost breakdown
        <span className={styles.costPreview}>~{formatCost(searchCost)} per search</span>
      </button>

      {showCosts && <CostInfoBox operations={costOps} cheapest={cheapestKey} />}

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label>Keywords</label>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. React developer" onKeyDown={e => e.key === 'Enter' && handleSearch()} />
        </div>
        <div className={styles.field}>
          <label>Location</label>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. London, UK" />
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={styles.field}>
          <label>Posted within</label>
          <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
            <option value="24h">Last 24 hours</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="any">Any time</option>
          </select>
        </div>
        <div className={styles.field}>
          <label>Max results</label>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
            <option value={3}>3 jobs</option>
            <option value={5}>5 jobs</option>
            <option value={10}>10 jobs</option>
            <option value={20}>20 jobs</option>
          </select>
        </div>
      </div>

      <div className={styles.actionRowTop}>
        <button className={styles.btnPrimary} onClick={handleSearch} disabled={!query.trim() || loading}>
          {loading ? '⏳ Searching & verifying adverts (~1 min)...' : '🔍 Search jobs'}
        </button>
        <CostBadge usd={searchCost} label={`Cost to search ${limit} jobs`} />
      </div>

      {error && <div className={styles.error}>⚠️ {error}</div>}

      {results && (
        <div className={styles.results}>
          {(!results.jobs || results.jobs.length === 0) && (
            <div className={styles.error}>
              🔍 No qualifying job adverts found for this search. You were still charged for the
              web searches — try broader keywords, another location, or a wider time window.
            </div>
          )}
          {results.search_tips?.length > 0 && (
            <div className={styles.recommendation}>
              💡 {results.search_tips.join(' · ')}
            </div>
          )}
          {results.jobs?.map((job, i) => (
            <div key={i} className={styles.jobCard}>
              <div className={styles.jobCardHeader}>
                <div>
                  <div className={styles.jobTitle}>{job.title}</div>
                  <div className={styles.jobCompany}>{job.company} · {job.location} · {job.type}</div>
                  <div className={styles.jobPosted}>
                    {job.posted && <>🕐 {job.posted} · </>}
                    {job.verified
                      ? <span style={{ color: 'var(--accent)' }}>✓ verified still open</span>
                      : <span title="LinkedIn/Indeed block automated checks — confirm on the advert page">⚠︎ not verified — check the advert</span>}
                  </div>
                </div>
                <div className={`${styles.scorePill} ${scoreClass(job.match_score)}`}>
                  {job.match_score}%
                </div>
              </div>
              <div className={styles.jobDesc}>{job.description}</div>
              {safeHttpUrl(job.url) && <a href={safeHttpUrl(job.url)} target="_blank" rel="noopener noreferrer" className={styles.jobLink}>View job ↗</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIPanel({ onJobFound }) {
  const [tab, setTab] = useState('analyse')

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>✦ AI Assistant</span>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'analyse' ? styles.tabActive : ''}`} onClick={() => setTab('analyse')}>Analyse job</button>
          <button className={`${styles.tab} ${tab === 'search' ? styles.tabActive : ''}`} onClick={() => setTab('search')}>Search jobs</button>
        </div>
      </div>

      {tab === 'analyse' && <AnalyseTab onJobFound={onJobFound} />}
      {tab === 'search' && <SearchTab />}
    </div>
  )
}
