import { useState, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import html2canvas from 'html2canvas'

interface FinancialData {
  year: number
  [key: string]: number | string
}

interface CompanyInfo {
  company: string
  display_name: string
  segment: string
  subsegment: string
}

interface Insight {
  title: string
  description: string
  value?: string
}

const METRICS = [
  { key: 'Net Revenue', label: 'Revenue' },
  { key: 'Cost of Goods', label: 'Cost of Goods' },
  { key: 'Total Assets', label: 'Assets' },
  { key: 'Gross Margin', label: 'Gross Margin' },
  { key: 'Operating Profit', label: 'Operating Profit' },
  { key: 'Net Profit', label: 'Net Profit' },
]

const METRIC_PRESETS = [
  {
    id: 'all',
    label: 'All Metrics',
    metrics: ['Net Revenue', 'Cost of Goods', 'Total Assets', 'Gross Margin', 'Operating Profit', 'Net Profit'],
  },
  {
    id: 'revenue',
    label: 'Revenue Metrics',
    metrics: ['Net Revenue', 'Cost of Goods'],
  },
  {
    id: 'profitability',
    label: 'Profitability',
    metrics: ['Gross Margin', 'Operating Profit', 'Net Profit'],
  },
  {
    id: 'assets',
    label: 'Assets & Equity',
    metrics: ['Total Assets'],
  },
]

const SEGMENTS = [
  'All Segments',
  'Department Store',
  'Discount Store',
  'Fast Fashion',
  'Grocery',
  'Health & Pharmacy',
  'Home Improvement',
  'Off Price',
  'Online',
  'Resale',
  'Specialty',
  'Warehouse Clubs',
]

function App() {
  // Company and data fetching
  const [allCompanies, setAllCompanies] = useState<CompanyInfo[]>([])
  const [company1, setCompany1] = useState<string>('')
  const [company2, setCompany2] = useState<string>('')
  const [chartData, setChartData] = useState<FinancialData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])

  // Filter state
  const [selectedSegment, setSelectedSegment] = useState('All Segments')
  const [selectedStartYear, setSelectedStartYear] = useState(2020)
  const [selectedEndYear, setSelectedEndYear] = useState(2024)
  const [selectedMetricPreset, setSelectedMetricPreset] = useState('all')

  // Refs for export functionality
  const chartsContainerRef = useRef<HTMLDivElement>(null)

  // Filtered companies list based on segment selection
  const filteredCompanies = selectedSegment === 'All Segments'
    ? allCompanies.map(c => c.display_name)
    : allCompanies.filter(c => c.segment === selectedSegment).map(c => c.display_name)

  // Get metric keys for current preset
  const currentMetricPreset = METRIC_PRESETS.find(p => p.id === selectedMetricPreset)
  const displayedMetrics = METRICS.filter(m => 
    currentMetricPreset?.metrics.includes(m.key)
  )

  useEffect(() => {
    fetchCompanyList()
  }, [])

  const fetchCompanyList = () => {
    const query = `SELECT company, display_name, segment, subsegment FROM company_info WHERE segment IS NOT NULL ORDER BY display_name`
    const url = `https://www.dolthub.com/api/v1alpha1/calvinw/BusMgmtBenchmarks?q=${encodeURIComponent(query)}`

    fetch(url)
      .then(res => res.json())
      .then(data => {
        const companies = data.rows as CompanyInfo[]
        setAllCompanies(companies)
        if (companies.length >= 2) {
          setCompany1(companies[0].display_name)
          setCompany2(companies[1].display_name)
        }
      })
      .catch(err => {
        console.error('Failed to fetch companies:', err)
        setError('Failed to load company list')
      })
  }

  const fetchComparisonData = () => {
    if (!company1 || !company2) {
      setError('Please select two companies')
      return
    }

    setLoading(true)
    setError(null)

    // Build SELECT clause with only requested metrics
    const selectedMetricKeys = displayedMetrics.map(m => `f.\`${m.key}\``).join(', ')
    const query = `
      SELECT f.company_name, f.year, ${selectedMetricKeys}
      FROM financials f
      WHERE (f.company_name = '${company1}' OR f.company_name = '${company2}')
      AND f.year BETWEEN ${selectedStartYear} AND ${selectedEndYear}
      ORDER BY f.year
    `
    const url = `https://www.dolthub.com/api/v1alpha1/calvinw/BusMgmtBenchmarks?q=${encodeURIComponent(query)}`

    fetch(url)
      .then(res => res.json())
      .then(data => {
        const financials = data.rows as any[]
        const chartDataByYear: { [year: number]: any } = {}

        financials.forEach(row => {
          if (!chartDataByYear[row.year]) {
            chartDataByYear[row.year] = { year: row.year }
          }
          displayedMetrics.forEach(metric => {
            const key = `${row.company_name} - ${metric.label}`
            chartDataByYear[row.year][key] = row[metric.key] || 0
          })
        })

        const sortedData = Object.values(chartDataByYear).sort((a, b) => a.year - b.year)
        setChartData(sortedData)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch data:', err)
        setError('Failed to load comparison data')
        setLoading(false)
      })
  }

  const generateInsights = () => {
    if (chartData.length === 0 || displayedMetrics.length === 0) {
      return
    }

    const newInsights: Insight[] = []
    
    // Use the first displayed metric for analysis
    const primaryMetric = displayedMetrics[0]
    const metricLabel = primaryMetric.label
    
    // Extract data for both companies
    const company1Data = chartData.map(d => ({
      year: d.year,
      value: d[`${company1} - ${metricLabel}`] as number || 0
    }))
    
    const company2Data = chartData.map(d => ({
      year: d.year,
      value: d[`${company2} - ${metricLabel}`] as number || 0
    }))
    
    // Insight 1: Average Performance Comparison (both companies)
    const company1Avg = company1Data.reduce((sum, d) => sum + d.value, 0) / company1Data.length
    const company2Avg = company2Data.reduce((sum, d) => sum + d.value, 0) / company2Data.length
    const topPerformer = company1Avg > company2Avg ? company1 : company2
    
    newInsights.push({
      title: '🏆 Average Performance',
      description: `${company1}: $${company1Avg.toLocaleString('en-US', { maximumFractionDigits: 0 })} | ${company2}: $${company2Avg.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${topPerformer} leads across ${selectedStartYear}-${selectedEndYear}).`
    })
    
    // Insight 2: Change Over Time (both companies)
    if (company1Data.length > 1 && company2Data.length > 1) {
      const company1Change = company1Data[company1Data.length - 1].value - company1Data[0].value
      const company2Change = company2Data[company2Data.length - 1].value - company2Data[0].value
      
      const company1Direction = company1Change > 0 ? 'improved' : 'declined'
      const company2Direction = company2Change > 0 ? 'improved' : 'declined'
      const company1ChangeAbs = Math.abs(company1Change)
      const company2ChangeAbs = Math.abs(company2Change)
      const biggestChanger = company1ChangeAbs > company2ChangeAbs ? company1 : company2
      
      newInsights.push({
        title: '📈 Change Over Time',
        description: `${company1} ${company1Direction} by $${company1ChangeAbs.toLocaleString('en-US', { maximumFractionDigits: 0 })} | ${company2} ${company2Direction} by $${company2ChangeAbs.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${biggestChanger} changed most from ${selectedStartYear} to ${selectedEndYear}).`
      })
    }
    
    // Insight 3: Volatility (both companies)
    const company1Volatility = Math.max(...company1Data.map(d => d.value)) - Math.min(...company1Data.map(d => d.value))
    const company2Volatility = Math.max(...company2Data.map(d => d.value)) - Math.min(...company2Data.map(d => d.value))
    
    const mostVolatile = company1Volatility > company2Volatility ? company1 : company2
    
    newInsights.push({
      title: '⚡ Variability Range',
      description: `${company1}: $${company1Volatility.toLocaleString('en-US', { maximumFractionDigits: 0 })} | ${company2}: $${company2Volatility.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${mostVolatile} shows highest fluctuation).`
    })
    
    setInsights(newInsights)
  }

  // Export functions
  const exportToCSV = () => {
    if (chartData.length === 0) {
      setError('No data to export. Please generate comparison data first.')
      return
    }

    // Get all keys except 'year'
    const headers = chartData.length > 0 
      ? Object.keys(chartData[0]).filter(key => key !== 'year')
      : []

    // Create CSV header row
    const csvHeader = ['Year', ...headers].join(',')

    // Create CSV data rows
    const csvRows = chartData.map(row => {
      const values = [row.year, ...headers.map(header => {
        const value = row[header as keyof typeof row]
        // Format numbers with commas and handle undefined/null
        return typeof value === 'number' 
          ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
          : (value || '')
      })]
      return values.join(',')
    })

    // Combine header and data
    const csvContent = [csvHeader, ...csvRows].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `${company1}_vs_${company2}_comparison.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setError(null)
  }

  const exportToPNG = async () => {
    if (!chartsContainerRef.current) {
      setError('Charts container not found')
      return
    }

    try {
      const canvas = await html2canvas(chartsContainerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      })

      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `${company1}_vs_${company2}_charts.png`
      link.style.visibility = 'hidden'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setError(null)
    } catch (err) {
      console.error('Failed to export charts:', err)
      setError('Failed to export charts as PNG')
    }
  }

  const colors: { [key: string]: string } = {
    [`${company1} - Revenue`]: '#1f77b4',
    [`${company1} - Cost of Goods`]: '#4472c4',
    [`${company1} - Assets`]: '#70ad47',
    [`${company1} - Gross Margin`]: '#ffc000',
    [`${company1} - Operating Profit`]: '#92d050',
    [`${company1} - Net Profit`]: '#31869b',
    [`${company2} - Revenue`]: '#ff7f0e',
    [`${company2} - Cost of Goods`]: '#ff8c3f',
    [`${company2} - Assets`]: '#ff6b6b',
    [`${company2} - Gross Margin`]: '#ffa500',
    [`${company2} - Operating Profit`]: '#d62728',
    [`${company2} - Net Profit`]: '#9467bd',
  }

  return (
    <div className="min-h-svh bg-gradient-to-br from-slate-50 to-white p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-slate-900 mb-3 tracking-tight">
            Financial Comparison Dashboard
          </h1>
          <p className="text-xl text-slate-600">Compare key financial metrics between retail companies</p>
        </div>

        {/* Filter Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-400 to-blue-600 rounded"></div>
            <h2 className="text-2xl font-bold text-slate-900">Filtering Options</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label htmlFor="segment-select" className="block text-sm font-semibold text-slate-700 mb-3">📂 Retail Category</label>
              <select
                id="segment-select"
                value={selectedSegment}
                onChange={e => {
                  setSelectedSegment(e.target.value)
                  const newFiltered = e.target.value === 'All Segments'
                    ? allCompanies.map(c => c.display_name)
                    : allCompanies.filter(c => c.segment === e.target.value).map(c => c.display_name)
                  if (newFiltered.length >= 2) {
                    setCompany1(newFiltered[0])
                    setCompany2(newFiltered[1])
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {SEGMENTS.map(segment => (
                  <option key={segment} value={segment}>{segment}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="start-year-select" className="block text-sm font-semibold text-slate-700 mb-3">📅 Start Year</label>
              <select
                id="start-year-select"
                value={selectedStartYear}
                onChange={e => setSelectedStartYear(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {[2018, 2019, 2020, 2021, 2022, 2023, 2024].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="end-year-select" className="block text-sm font-semibold text-slate-700 mb-3">📅 End Year</label>
              <select
                id="end-year-select"
                value={selectedEndYear}
                onChange={e => setSelectedEndYear(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {[2018, 2019, 2020, 2021, 2022, 2023, 2024].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="metric-select" className="block text-sm font-semibold text-slate-700 mb-3">📊 Metrics</label>
              <select
                id="metric-select"
                value={selectedMetricPreset}
                onChange={e => setSelectedMetricPreset(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {METRIC_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Company Selection Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded"></div>
            <h2 className="text-2xl font-bold text-slate-900">Company Comparison</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <label htmlFor="company1-select" className="block text-sm font-semibold text-slate-700 mb-3">🏢 Company 1</label>
              <select
                id="company1-select"
                value={company1}
                onChange={e => setCompany1(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              >
                <option value="">Select Company</option>
                {filteredCompanies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="company2-select" className="block text-sm font-semibold text-slate-700 mb-3">🏢 Company 2</label>
              <select
                id="company2-select"
                value={company2}
                onChange={e => setCompany2(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              >
                <option value="">Select Company</option>
                {filteredCompanies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={fetchComparisonData}
              disabled={loading || !company1 || !company2}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:scale-100 shadow-lg"
            >
              {loading ? '⏳ Loading...' : '▶️ Compare Companies'}
            </button>
            <button
              onClick={generateInsights}
              disabled={chartData.length === 0}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:scale-100 shadow-lg"
            >
              ✨ Generate Insights
            </button>
          </div>

          {chartData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <button
                onClick={exportToCSV}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
              >
                📥 Download CSV
              </button>
              <button
                onClick={exportToPNG}
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
              >
                📊 Export as PNG
              </button>
            </div>
          )}

          {error && <p className="text-red-600 mt-6 text-center font-semibold bg-red-50 border border-red-200 rounded-xl p-4">{error}</p>}
        </div>

        {chartData.length > 0 && (
          <div>
            {/* Performance Trends Section */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1 h-10 bg-gradient-to-b from-cyan-400 to-cyan-600 rounded"></div>
                <h2 className="text-3xl font-bold text-slate-900">Performance Trends</h2>
              </div>
              <div ref={chartsContainerRef} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {displayedMetrics.map(metric => (
                  <div key={metric.key} className="group bg-white rounded-2xl border border-slate-200 p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <span className="text-2xl">📈</span>
                      {metric.label}
                    </h3>
                    <div className="bg-slate-50 rounded-xl p-4">
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                          <XAxis dataKey="year" stroke="rgba(0,0,0,0.6)" label={{ value: 'Year', position: 'insideBottomRight', offset: -5, fill: 'rgba(0,0,0,0.8)' }} />
                          <YAxis stroke="rgba(0,0,0,0.6)" label={{ value: 'USD (thousands)', angle: -90, position: 'left', offset: 10, fill: 'rgba(0,0,0,0.8)' }} />
                          <Tooltip 
                            formatter={(value: any) => value ? `$${value.toLocaleString()}` : '$0'}
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '12px', color: '#000' }}
                          />
                          <Legend wrapperStyle={{ paddingTop: '20px', color: 'rgba(0,0,0,0.8)' }} />
                          <Line
                            type="monotone"
                            dataKey={`${company1} - ${metric.label}`}
                            stroke={colors[`${company1} - ${metric.label}`] || '#000'}
                            strokeWidth={3}
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey={`${company2} - ${metric.label}`}
                            stroke={colors[`${company2} - ${metric.label}`] || '#000'}
                            strokeWidth={3}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {insights.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-10 bg-gradient-to-b from-pink-400 to-pink-600 rounded"></div>
                  <h2 className="text-3xl font-bold text-slate-900">Key Insights</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {insights.map((insight, index) => (
                    <div key={index} className="group bg-white rounded-2xl border border-slate-200 p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-pink-400 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <h3 className="text-lg font-bold text-slate-900 mb-4 pl-4">{insight.title}</h3>
                      <p className="text-slate-700 leading-relaxed pl-4">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
