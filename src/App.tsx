import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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
    
    // Insight 1: Highest Performing Company (based on average value)
    const company1Avg = company1Data.reduce((sum, d) => sum + d.value, 0) / company1Data.length
    const company2Avg = company2Data.reduce((sum, d) => sum + d.value, 0) / company2Data.length
    const topPerformer = company1Avg > company2Avg ? company1 : company2
    const topValue = Math.max(company1Avg, company2Avg)
    
    newInsights.push({
      title: '🏆 Highest Performing Company',
      description: `${topPerformer} leads with an average ${metricLabel} of $${topValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} across ${selectedStartYear}-${selectedEndYear}.`
    })
    
    // Insight 2: Biggest Improvement (year-over-year change from first to last year)
    if (company1Data.length > 1 && company2Data.length > 1) {
      const company1Change = company1Data[company1Data.length - 1].value - company1Data[0].value
      const company2Change = company2Data[company2Data.length - 1].value - company2Data[0].value
      
      const biggestImprover = Math.abs(company1Change) > Math.abs(company2Change) ? company1 : company2
      const improverChange = Math.max(Math.abs(company1Change), Math.abs(company2Change))
      const direction = (biggestImprover === company1 ? company1Change : company2Change) > 0 ? 'improved' : 'declined'
      
      newInsights.push({
        title: '📈 Biggest Change Over Time',
        description: `${biggestImprover} ${direction} by $${improverChange.toLocaleString('en-US', { maximumFractionDigits: 0 })} from ${selectedStartYear} to ${selectedEndYear}.`
      })
    }
    
    // Insight 3: Volatility (standard deviation or range)
    const company1Volatility = Math.max(...company1Data.map(d => d.value)) - Math.min(...company1Data.map(d => d.value))
    const company2Volatility = Math.max(...company2Data.map(d => d.value)) - Math.min(...company2Data.map(d => d.value))
    
    const mostVolatile = company1Volatility > company2Volatility ? company1 : company2
    const volatilityRange = Math.max(company1Volatility, company2Volatility)
    
    newInsights.push({
      title: '⚡ Highest Variability',
      description: `${mostVolatile} shows the largest fluctuation in ${metricLabel}, with a range of $${volatilityRange.toLocaleString('en-US', { maximumFractionDigits: 0 })} between its highest and lowest values.`
    })
    
    setInsights(newInsights)
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
    <div className="min-h-svh bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2">Company Financial Comparison</h1>
        <p className="text-center text-gray-600 mb-8">Compare financial metrics between two companies</p>

        {/* Filter Panel */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div>
              <label htmlFor="segment-select" className="block text-sm font-semibold mb-2">Retail Category</label>
              <select
                id="segment-select"
                value={selectedSegment}
                onChange={e => {
                  setSelectedSegment(e.target.value)
                  // Reset company selections when segment changes
                  const newFiltered = e.target.value === 'All Segments'
                    ? allCompanies.map(c => c.display_name)
                    : allCompanies.filter(c => c.segment === e.target.value).map(c => c.display_name)
                  if (newFiltered.length >= 2) {
                    setCompany1(newFiltered[0])
                    setCompany2(newFiltered[1])
                  }
                }}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SEGMENTS.map(segment => (
                  <option key={segment} value={segment}>{segment}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="start-year-select" className="block text-sm font-semibold mb-2">Start Year</label>
              <select
                id="start-year-select"
                value={selectedStartYear}
                onChange={e => setSelectedStartYear(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2018, 2019, 2020, 2021, 2022, 2023, 2024].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="end-year-select" className="block text-sm font-semibold mb-2">End Year</label>
              <select
                id="end-year-select"
                value={selectedEndYear}
                onChange={e => setSelectedEndYear(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2018, 2019, 2020, 2021, 2022, 2023, 2024].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="metric-select" className="block text-sm font-semibold mb-2">Metrics</label>
              <select
                id="metric-select"
                value={selectedMetricPreset}
                onChange={e => setSelectedMetricPreset(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {METRIC_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Company Selection Panel */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-xl font-semibold mb-4">Select Companies to Compare</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="company1-select" className="block text-sm font-semibold mb-2">Company 1</label>
              <select
                id="company1-select"
                value={company1}
                onChange={e => setCompany1(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Company</option>
                {filteredCompanies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="company2-select" className="block text-sm font-semibold mb-2">Company 2</label>
              <select
                id="company2-select"
                value={company2}
                onChange={e => setCompany2(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Compare Companies'}
            </button>
            <button
              onClick={generateInsights}
              disabled={chartData.length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Generate Insights
            </button>
          </div>

          {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
        </div>

        {chartData.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Financial Metrics Comparison</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {displayedMetrics.map(metric => (
                <div key={metric.key} className="bg-white rounded-lg shadow-lg p-8">
                  <h3 className="text-xl font-semibold mb-4">{metric.label}</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottomRight', offset: -5 }} />
                      <YAxis label={{ value: 'USD (thousands)', angle: -90, position: 'left', offset: 10 }} />
                      <Tooltip 
                        formatter={(value: any) => value ? `$${value.toLocaleString()}` : '$0'}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line
                        type="monotone"
                        dataKey={`${company1} - ${metric.label}`}
                        stroke={colors[`${company1} - ${metric.label}`] || '#000'}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey={`${company2} - ${metric.label}`}
                        stroke={colors[`${company2} - ${metric.label}`] || '#000'}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>

            {insights.length > 0 && (
              <div className="mt-8">
                <h2 className="text-2xl font-bold mb-6">AI-Generated Insights</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {insights.map((insight, index) => (
                    <div key={index} className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
                      <h3 className="text-lg font-semibold mb-3 text-gray-800">{insight.title}</h3>
                      <p className="text-gray-700 leading-relaxed">{insight.description}</p>
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
