import { useState, useEffect, useRef } from 'react'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart, ScatterChart, Scatter, ZAxis } from 'recharts'

interface FinancialData {
  year: number
  [key: string]: number | string
}

interface CompanyInfo {
  company: string
  display_name: string
  segment: string
  subsegment: string
  currency: string
}

const getCurrencySymbol = (currencyCode: string): string => {
  const symbols: { [key: string]: string } = {
    'USD': '$',
    'GBP': '£',
    'EUR': '€',
    'CAD': 'C$',
    'AUD': 'A$',
    'JPY': '¥',
    'CNY': '¥',
  }
  return symbols[currencyCode] || currencyCode
}

const getCurrencyName = (currencyCode: string): string => {
  const names: { [key: string]: string } = {
    'USD': 'US Dollars',
    'GBP': 'British Pounds',
    'EUR': 'Euros',
    'CAD': 'Canadian Dollars',
    'AUD': 'Australian Dollars',
    'JPY': 'Japanese Yen',
    'CNY': 'Chinese Yuan',
  }
  return names[currencyCode] || currencyCode
}

interface CompanySummary {
  companyName: string
  segment: string
  currency: string
  avgRevenue: number
  avgProfit: number
  revenueGrowth: number
  profitTrend: string
  topMetric: string
  performanceNote: string
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
  const [summary, setSummary] = useState<{ company1: CompanySummary | null, company2: CompanySummary | null, comparison: string }>({ company1: null, company2: null, comparison: '' })
  const [rawFinancials, setRawFinancials] = useState<any[]>([])

  // Filter state
  const [selectedSegment, setSelectedSegment] = useState('All Segments')
  const [selectedStartYear, setSelectedStartYear] = useState(2020)
  const [selectedEndYear, setSelectedEndYear] = useState(2024)
  const [selectedMetricPreset, setSelectedMetricPreset] = useState('all')
  const [chartType, setChartType] = useState<'line-smooth' | 'line-straight' | 'line-dots' | 'bar' | 'area' | 'composed' | 'radar' | 'scatter'>('line-smooth')

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
    const query = `SELECT company, display_name, segment, subsegment, currency FROM company_info WHERE segment IS NOT NULL ORDER BY display_name`
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
            chartDataByYear[row.year] = { year: Number(row.year) }
          }
          displayedMetrics.forEach(metric => {
            const key = `${row.company_name} - ${metric.label}`
            // Convert to number since API returns strings
            chartDataByYear[row.year][key] = Number(row[metric.key]) || 0
          })
        })

        const sortedData = Object.values(chartDataByYear).sort((a, b) => a.year - b.year)
        setChartData(sortedData)
        setRawFinancials(financials)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch data:', err)
        setError('Failed to load comparison data')
        setLoading(false)
      })
  }

  const generateSummary = () => {
    if (chartData.length === 0 || !company1 || !company2) {
      return
    }

    // Helper function to calculate company summary
    const calculateCompanySummary = (companyName: string): CompanySummary => {
      // Get company info
      const companyInfo = allCompanies.find(c => c.display_name === companyName)
      const segment = companyInfo?.segment || 'Unknown'
      const currency = companyInfo?.currency || 'USD'

      // Calculate averages and trends for each metric
      const revenueData = chartData.map(d => d[`${companyName} - Revenue`] as number || 0).filter(v => v > 0)
      const profitData = chartData.map(d => d[`${companyName} - Net Profit`] as number || 0)
      const assetsData = chartData.map(d => d[`${companyName} - Assets`] as number || 0).filter(v => v > 0)
      
      const avgRevenue = revenueData.length > 0 ? revenueData.reduce((a, b) => a + b, 0) / revenueData.length : 0
      
      // Calculate profit margin as a percentage (Net Profit / Revenue * 100)
      // We pair each year's profit with its revenue to get accurate margins
      let profitMargins: number[] = []
      chartData.forEach(d => {
        const revenue = d[`${companyName} - Revenue`] as number || 0
        const profit = d[`${companyName} - Net Profit`] as number || 0
        if (revenue > 0) {
          profitMargins.push((profit / revenue) * 100)
        }
      })
      const avgProfit = profitMargins.length > 0 ? profitMargins.reduce((a, b) => a + b, 0) / profitMargins.length : 0
      
      // Calculate revenue growth
      const revenueGrowth = revenueData.length > 1 
        ? ((revenueData[revenueData.length - 1] - revenueData[0]) / revenueData[0]) * 100 
        : 0
      
      // Determine profit trend
      let profitTrend = 'stable'
      if (profitData.length > 1) {
        const firstHalf = profitData.slice(0, Math.floor(profitData.length / 2))
        const secondHalf = profitData.slice(Math.floor(profitData.length / 2))
        const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
        
        if (avgSecondHalf > avgFirstHalf * 1.05) profitTrend = 'improving'
        else if (avgSecondHalf < avgFirstHalf * 0.95) profitTrend = 'declining'
      }
      
      // Find top metric (highest average value)
      const metrics = [
        { name: 'Revenue', value: avgRevenue },
        { name: 'Assets', value: assetsData.length > 0 ? assetsData.reduce((a, b) => a + b, 0) / assetsData.length : 0 }
      ]
      const topMetric = metrics.reduce((a, b) => a.value > b.value ? a : b).name
      
      // Performance note
      let performanceNote = ''
      if (revenueGrowth > 20) {
        performanceNote = 'Strong growth trajectory with expanding market presence.'
      } else if (revenueGrowth > 5) {
        performanceNote = 'Steady growth with consistent performance.'
      } else if (revenueGrowth > -5) {
        performanceNote = 'Stable performance with minor fluctuations.'
      } else {
        performanceNote = 'Facing challenges with declining revenues.'
      }

      return {
        companyName,
        segment,
        currency,
        avgRevenue,
        avgProfit,
        revenueGrowth,
        profitTrend,
        topMetric,
        performanceNote
      }
    }

    const summary1 = calculateCompanySummary(company1)
    const summary2 = calculateCompanySummary(company2)

    // Generate comparison text
    let comparison = ''
    
    if (summary1.avgRevenue > summary2.avgRevenue * 1.2) {
      comparison = `${company1} significantly outperforms ${company2} in revenue generation, averaging ${((summary1.avgRevenue / summary2.avgRevenue - 1) * 100).toFixed(0)}% more. `
    } else if (summary2.avgRevenue > summary1.avgRevenue * 1.2) {
      comparison = `${company2} significantly outperforms ${company1} in revenue generation, averaging ${((summary2.avgRevenue / summary1.avgRevenue - 1) * 100).toFixed(0)}% more. `
    } else {
      comparison = `Both companies show comparable revenue levels, with ${summary1.avgRevenue > summary2.avgRevenue ? company1 : company2} holding a slight edge. `
    }

    if (summary1.revenueGrowth > summary2.revenueGrowth + 10) {
      comparison += `${company1} demonstrates stronger growth momentum with ${summary1.revenueGrowth.toFixed(1)}% growth versus ${company2}'s ${summary2.revenueGrowth.toFixed(1)}%. `
    } else if (summary2.revenueGrowth > summary1.revenueGrowth + 10) {
      comparison += `${company2} demonstrates stronger growth momentum with ${summary2.revenueGrowth.toFixed(1)}% growth versus ${company1}'s ${summary1.revenueGrowth.toFixed(1)}%. `
    } else {
      comparison += `Both companies show similar growth trajectories over the selected period. `
    }

    if (summary1.profitTrend === 'improving' && summary2.profitTrend !== 'improving') {
      comparison += `${company1} shows improving profitability trends, which may indicate better operational efficiency.`
    } else if (summary2.profitTrend === 'improving' && summary1.profitTrend !== 'improving') {
      comparison += `${company2} shows improving profitability trends, which may indicate better operational efficiency.`
    } else {
      comparison += `Both companies maintain ${summary1.profitTrend} profitability patterns.`
    }

    setSummary({ company1: summary1, company2: summary2, comparison })
  }

  // Export functions
  const exportToCSV = () => {
    if (chartData.length === 0 || rawFinancials.length === 0) {
      setError('No data to export. Please generate comparison data first.')
      return
    }

    // Define units for each metric
    const metricUnits: { [key: string]: string } = {
      'Net Revenue': '(Millions USD)',
      'Cost of Goods': '(Millions USD)',
      'Total Assets': '(Millions USD)',
      'Gross Margin': '(%)',
      'Operating Profit': '(%)',
      'Net Profit': '(%)',
    }

    // Get all unique raw financial metrics
    const allRawKeys = new Set<string>()
    rawFinancials.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== 'company_name' && key !== 'year') {
          allRawKeys.add(key)
        }
      })
    })
    const rawHeaders = Array.from(allRawKeys).sort()

    // Get all selected metrics (financial metrics)
    const selectedMetricKeys = displayedMetrics.map(m => m.key)

    // Create a combined dataset by year
    const combinedData: { [year: number]: any } = {}

    // Initialize combined data from chart data (which has financial metrics)
    chartData.forEach(row => {
      combinedData[row.year] = { year: row.year }
    })

    // Add raw financial data to combined data
    rawFinancials.forEach(row => {
      const year = row.year
      if (!combinedData[year]) {
        combinedData[year] = { year }
      }

      if (row.company_name === company1) {
        combinedData[year][`${company1}_raw`] = row
      } else if (row.company_name === company2) {
        combinedData[year][`${company2}_raw`] = row
      }
    })

    // Sort by year
    const sortedYears = Object.keys(combinedData).map(Number).sort((a, b) => a - b)

    // Build header row
    const headers: string[] = ['Year']

    // Add raw financial headers for company 1
    rawHeaders.forEach(header => {
      headers.push(`${company1} - ${header}`)
    })

    // Add financial metrics headers for company 1
    selectedMetricKeys.forEach(metric => {
      const unit = metricUnits[metric] || ''
      headers.push(`${company1} - ${metric} ${unit}`)
    })

    // Add raw financial headers for company 2
    rawHeaders.forEach(header => {
      headers.push(`${company2} - ${header}`)
    })

    // Add financial metrics headers for company 2
    selectedMetricKeys.forEach(metric => {
      const unit = metricUnits[metric] || ''
      headers.push(`${company2} - ${metric} ${unit}`)
    })

    // Create CSV header with clear section separators
    let csvContent = 'FINANCIAL DATA COMPARISON\n'
    csvContent += '=========================\n\n'
    csvContent += headers.join(',') + '\n'

    // Create data rows
    sortedYears.forEach(year => {
      const yearData = combinedData[year]
      const values: (string | number)[] = [year]

      // Add company1 raw financial data
      rawHeaders.forEach(header => {
        const rawData = yearData[`${company1}_raw`]
        if (rawData) {
          const value = rawData[header]
          values.push(typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '')
        } else {
          values.push('')
        }
      })

      // Add company1 financial metrics
      selectedMetricKeys.forEach(metric => {
        const key = `${company1} - ${metric}`
        const value = yearData[key]
        values.push(typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '')
      })

      // Add company2 raw financial data
      rawHeaders.forEach(header => {
        const rawData = yearData[`${company2}_raw`]
        if (rawData) {
          const value = rawData[header]
          values.push(typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '')
        } else {
          values.push('')
        }
      })

      // Add company2 financial metrics
      selectedMetricKeys.forEach(metric => {
        const key = `${company2} - ${metric}`
        const value = yearData[key]
        values.push(typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '')
      })

      csvContent += values.join(',') + '\n'
    })

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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

            <div>
              <label htmlFor="chart-type-select" className="block text-sm font-semibold text-slate-700 mb-3">📈 Chart Type</label>
              <select
                id="chart-type-select"
                value={chartType}
                onChange={e => setChartType(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="line-smooth">📈 Smooth Line - See trends flow naturally</option>
                <option value="line-straight">📉 Straight Line - Connect points directly</option>
                <option value="bar">📊 Bar Chart - Compare values side-by-side</option>
                <option value="area">🗻 Area Chart - Show volume over time</option>
                <option value="composed">🎯 Combined - Bars + trend line together</option>
                <option value="scatter">🔵 Scatter Plot - See data point distribution</option>
                <option value="radar">🕸️ Radar - Compare across all metrics</option>
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
              onClick={generateSummary}
              disabled={chartData.length === 0}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:scale-100 shadow-lg"
            >
              📝 Generate Summary
            </button>
          </div>

          {chartData.length > 0 && (
            <div className="mt-6">
              <button
                onClick={exportToCSV}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
              >
                📥 Download CSV
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

              {/* Radar Chart - Special view showing all metrics at once */}
              {chartType === 'radar' && (
                <div className="mb-8">
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-lg">
                    <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <span className="text-3xl">🕸️</span>
                      Multi-Metric Comparison (Latest Year: {chartData[chartData.length - 1]?.year})
                    </h3>
                    <p className="text-slate-600 mb-6">
                      This spider web chart compares both companies across all metrics at once. Each point on the web represents a different financial metric. The larger the shape, the better the overall performance.
                    </p>
                    <div className="bg-slate-50 rounded-xl p-6">
                      <ResponsiveContainer width="100%" height={500}>
                        <RadarChart data={(() => {
                          const latestData = chartData[chartData.length - 1]
                          return displayedMetrics.map(metric => ({
                            metric: metric.label,
                            [company1]: latestData[`${company1} - ${metric.label}`] || 0,
                            [company2]: latestData[`${company2} - ${metric.label}`] || 0,
                          }))
                        })()}>
                          <PolarGrid stroke="rgba(0,0,0,0.2)" strokeWidth={1} />
                          <PolarAngleAxis 
                            dataKey="metric" 
                            tick={{ fill: 'rgba(0,0,0,0.8)', fontSize: 13, fontWeight: 600 }}
                          />
                          <PolarRadiusAxis 
                            angle={90} 
                            domain={[0, 'auto']}
                            tick={{ fill: 'rgba(0,0,0,0.6)' }}
                          />
                          <Radar
                            name={company1}
                            dataKey={company1}
                            stroke="#1f77b4"
                            fill="#1f77b4"
                            fillOpacity={0.25}
                            strokeWidth={3}
                          />
                          <Radar
                            name={company2}
                            dataKey={company2}
                            stroke="#ff7f0e"
                            fill="#ff7f0e"
                            fillOpacity={0.25}
                            strokeWidth={3}
                          />
                          <Tooltip 
                            formatter={(value: any) => value ? `$${value.toLocaleString()}` : '$0'}
                            contentStyle={{ backgroundColor: '#fff', border: '2px solid #ccc', borderRadius: '12px', color: '#000', padding: '12px' }}
                          />
                          <Legend 
                            wrapperStyle={{ paddingTop: '20px' }}
                            iconType="circle"
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Regular charts grid */}
              {chartType !== 'radar' && (
                <div ref={chartsContainerRef} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {displayedMetrics.map(metric => (
                    <div key={metric.key} className="group bg-white rounded-2xl border border-slate-200 p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                        <span className="text-2xl">📊</span>
                        {metric.label}
                      </h3>
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 shadow-inner">
                        <ResponsiveContainer width="100%" height={420}>
                          {chartType === 'bar' ? (
                            <BarChart data={chartData} margin={{ top: 20, right: 40, left: 120, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="5 5" stroke="rgba(0,0,0,0.08)" />
                              <XAxis 
                                dataKey="year" 
                                stroke="rgba(0,0,0,0.7)" 
                                tick={{ fontSize: 13, fontWeight: 500 }}
                                label={{ value: 'Year', position: 'insideBottomRight', offset: -10, fill: 'rgba(0,0,0,0.8)', fontWeight: 600 }} 
                              />
                              <YAxis 
                                stroke="rgba(0,0,0,0.7)" 
                                tick={{ fontSize: 12 }}
                                label={{ value: 'USD (thousands)', angle: -90, position: 'left', offset: 20, fill: 'rgba(0,0,0,0.8)', fontWeight: 600 }} 
                              />
                              <Tooltip 
                                formatter={(value: any) => value ? `$${value.toLocaleString()}` : '$0'}
                                contentStyle={{ backgroundColor: '#fff', border: '2px solid #e2e8f0', borderRadius: '12px', color: '#000', padding: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                              />
                              <Legend 
                                wrapperStyle={{ paddingTop: '25px' }}
                                iconType="rect"
                              />
                              <Bar
                                dataKey={`${company1} - ${metric.label}`}
                                fill={colors[`${company1} - ${metric.label}`] || '#1f77b4'}
                                radius={[8, 8, 0, 0]}
                                isAnimationActive={false}
                              />
                              <Bar
                                dataKey={`${company2} - ${metric.label}`}
                                fill={colors[`${company2} - ${metric.label}`] || '#ff7f0e'}
                                radius={[8, 8, 0, 0]}
                                isAnimationActive={false}
                              />
                            </BarChart>
                          ) : chartType === 'area' ? (
                            <AreaChart data={chartData} margin={{ top: 20, right: 40, left: 120, bottom: 20 }}>
                              <defs>
                                <linearGradient id={`gradient-${company1}-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={colors[`${company1} - ${metric.label}`] || '#1f77b4'} stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor={colors[`${company1} - ${metric.label}`] || '#1f77b4'} stopOpacity={0.1}/>
                                </linearGradient>
                                <linearGradient id={`gradient-${company2}-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={colors[`${company2} - ${metric.label}`] || '#ff7f0e'} stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor={colors[`${company2} - ${metric.label}`] || '#ff7f0e'} stopOpacity={0.1}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="5 5" stroke="rgba(0,0,0,0.08)" />
                              <XAxis 
                                dataKey="year" 
                                stroke="rgba(0,0,0,0.7)" 
                                tick={{ fontSize: 13, fontWeight: 500 }}
                                label={{ value: 'Year', position: 'insideBottomRight', offset: -10, fill: 'rgba(0,0,0,0.8)', fontWeight: 600 }} 
                              />
                              <YAxis 
                                stroke="rgba(0,0,0,0.7)" 
                                tick={{ fontSize: 12 }}
                                label={{ value: 'USD (thousands)', angle: -90, position: 'left', offset: 20, fill: 'rgba(0,0,0,0.8)', fontWeight: 600 }} 
                              />
                              <Tooltip 
                                formatter={(value: any) => value ? `$${value.toLocaleString()}` : '$0'}
                                contentStyle={{ backgroundColor: '#fff', border: '2px solid #e2e8f0', borderRadius: '12px', color: '#000', padding: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                              />
                              <Legend 
                                wrapperStyle={{ paddingTop: '25px' }}
                                iconType="rect"
                              />
                              <Area
                                type="monotone"
                                dataKey={`${company1} - ${metric.label}`}
                                stroke={colors[`${company1} - ${metric.label}`] || '#1f77b4'}
                                fill={`url(#gradient-${company1}-${metric.key})`}
                                strokeWidth={3}
                                isAnimationActive={false}
                              />
                              <Area
                                type="monotone"
                                dataKey={`${company2} - ${metric.label}`}
                                stroke={colors[`${company2} - ${metric.label}`] || '#ff7f0e'}
                                fill={`url(#gradient-${company2}-${metric.key})`}
                                strokeWidth={3}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          ) : chartType === 'composed' ? (
                            <ComposedChart data={chartData} margin={{ top: 20, right: 40, left: 120, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="5 5" stroke="rgba(0,0,0,0.08)" />
                              <XAxis 
                                dataKey="year" 
                                stroke="rgba(0,0,0,0.7)" 
                                tick={{ fontSize: 13, fontWeight: 500 }}
                                label={{ value: 'Year', position: 'insideBottomRight', offset: -10, fill: 'rgba(0,0,0,0.8)', fontWeight: 600 }} 
                              />
                              <YAxis 
                                stroke="rgba(0,0,0,0.7)" 
                                tick={{ fontSize: 12 }}
                                label={{ value: 'USD (thousands)', angle: -90, position: 'left', offset: 20, fill: 'rgba(0,0,0,0.8)', fontWeight: 600 }} 
                              />
                              <Tooltip 
                                formatter={(value: any) => value ? `$${value.toLocaleString()}` : '$0'}
                                contentStyle={{ backgroundColor: '#fff', border: '2px solid #e2e8f0', borderRadius: '12px', color: '#000', padding: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                              />
                              <Legend 
                                wrapperStyle={{ paddingTop: '25px' }}
                                iconType="rect"
                              />
                              <Bar
                                dataKey={`${company1} - ${metric.label}`}
                                fill={colors[`${company1} - ${metric.label}`] || '#1f77b4'}
                                radius={[8, 8, 0, 0]}
                                isAnimationActive={false}
                              />
                              <Bar
                                dataKey={`${company2} - ${metric.label}`}
                                fill={colors[`${company2} - ${metric.label}`] || '#ff7f0e'}
                                radius={[8, 8, 0, 0]}
                                isAnimationActive={false}
                              />
                              <Line
                                type="monotone"
                                dataKey={`${company1} - ${metric.label}`}
                                stroke={colors[`${company1} - ${metric.label}`] || '#1f77b4'}
                                strokeWidth={3}
                                dot={{ fill: colors[`${company1} - ${metric.label}`] || '#1f77b4', r: 5 }}
                                isAnimationActive={false}
                              />
                              <Line
                                type="monotone"
                                dataKey={`${company2} - ${metric.label}`}
                                stroke={colors[`${company2} - ${metric.label}`] || '#ff7f0e'}
                                strokeWidth={3}
                                dot={{ fill: colors[`${company2} - ${metric.label}`] || '#ff7f0e', r: 5 }}
                                isAnimationActive={false}
                              />
                            </ComposedChart>
                          ) : chartType === 'scatter' ? (
                            <ScatterChart margin={{ top: 20, right: 40, left: 120, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="5 5" stroke="rgba(0,0,0,0.08)" />
                              <XAxis 
                                type="number"
                                dataKey="year" 
                                name="Year"
                                stroke="rgba(0,0,0,0.7)" 
                                tick={{ fontSize: 13, fontWeight: 500 }}
                                label={{ value: 'Year', position: 'insideBottomRight', offset: -10, fill: 'rgba(0,0,0,0.8)', fontWeight: 600 }}
                                domain={['dataMin', 'dataMax']}
                              />
                              <YAxis 
                                type="number"
                                stroke="rgba(0,0,0,0.7)" 
                                tick={{ fontSize: 12 }}
                                label={{ value: 'USD (thousands)', angle: -90, position: 'left', offset: 20, fill: 'rgba(0,0,0,0.8)', fontWeight: 600 }} 
                                domain={['auto', 'auto']}
                              />
                              <ZAxis range={[100, 400]} />
                              <Tooltip 
                                formatter={(value: any) => value ? `$${value.toLocaleString()}` : '$0'}
                                contentStyle={{ backgroundColor: '#fff', border: '2px solid #e2e8f0', borderRadius: '12px', color: '#000', padding: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                                cursor={{ strokeDasharray: '3 3' }}
                              />
                              <Legend 
                                wrapperStyle={{ paddingTop: '25px' }}
                                iconType="circle"
                              />
                              <Scatter
                                name={company1}
                                data={chartData.map(d => ({ year: d.year, value: d[`${company1} - ${metric.label}`] }))}
                                dataKey="value"
                                fill={colors[`${company1} - ${metric.label}`] || '#1f77b4'}
                                isAnimationActive={false}
                              />
                              <Scatter
                                name={company2}
                                data={chartData.map(d => ({ year: d.year, value: d[`${company2} - ${metric.label}`] }))}
                                dataKey="value"
                                fill={colors[`${company2} - ${metric.label}`] || '#ff7f0e'}
                                isAnimationActive={false}
                              />
                            </ScatterChart>
                          ) : (
                            <LineChart data={chartData} margin={{ top: 20, right: 40, left: 120, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="5 5" stroke="rgba(0,0,0,0.08)" />
                              <XAxis 
                                dataKey="year" 
                                stroke="rgba(0,0,0,0.7)" 
                                tick={{ fontSize: 13, fontWeight: 500 }}
                                label={{ value: 'Year', position: 'insideBottomRight', offset: -10, fill: 'rgba(0,0,0,0.8)', fontWeight: 600 }} 
                              />
                              <YAxis 
                                stroke="rgba(0,0,0,0.7)" 
                                tick={{ fontSize: 12 }}
                                label={{ value: 'USD (thousands)', angle: -90, position: 'left', offset: 20, fill: 'rgba(0,0,0,0.8)', fontWeight: 600 }} 
                              />
                              <Tooltip 
                                formatter={(value: any) => value ? `$${value.toLocaleString()}` : '$0'}
                                contentStyle={{ backgroundColor: '#fff', border: '2px solid #e2e8f0', borderRadius: '12px', color: '#000', padding: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                              />
                              <Legend 
                                wrapperStyle={{ paddingTop: '25px' }}
                                iconType="line"
                              />
                              <Line
                                type={chartType === 'line-smooth' ? 'monotone' : 'linear'}
                                dataKey={`${company1} - ${metric.label}`}
                                stroke={colors[`${company1} - ${metric.label}`] || '#1f77b4'}
                                strokeWidth={4}
                                dot={{ fill: colors[`${company1} - ${metric.label}`] || '#1f77b4', r: 6, strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 8, strokeWidth: 2 }}
                                isAnimationActive={false}
                              />
                              <Line
                                type={chartType === 'line-smooth' ? 'monotone' : 'linear'}
                                dataKey={`${company2} - ${metric.label}`}
                                stroke={colors[`${company2} - ${metric.label}`] || '#ff7f0e'}
                                strokeWidth={4}
                                dot={{ fill: colors[`${company2} - ${metric.label}`] || '#ff7f0e', r: 6, strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 8, strokeWidth: 2 }}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {summary.company1 && summary.company2 && (
              <div className="mt-12">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-10 bg-gradient-to-b from-purple-400 to-purple-600 rounded"></div>
                  <h2 className="text-3xl font-bold text-slate-900">Company Summaries</h2>
                </div>

                {/* Comparison Overview */}
                <div className="mb-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-8 shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">🔍</span>
                    <h3 className="text-2xl font-bold text-slate-900">Comparison Overview</h3>
                  </div>
                  <p className="text-lg text-slate-700 leading-relaxed">
                    {summary.comparison}
                  </p>
                </div>

                {/* Company Cards Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Company 1 Summary */}
                  <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-slate-200">
                      <span className="text-4xl">🏢</span>
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">{summary.company1.companyName}</h3>
                        <p className="text-sm text-slate-600 font-semibold mt-1">
                          {summary.company1.segment}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">💰</span>
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Average Revenue</h4>
                        </div>
                        <p className="text-3xl font-bold text-blue-900">
                          {getCurrencySymbol(summary.company1.currency)}{(summary.company1.avgRevenue / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} million
                        </p>
                        <p className="text-sm text-slate-600 mt-1">{getCurrencyName(summary.company1.currency)} per year</p>
                      </div>

                      <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">📈</span>
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Revenue Growth</h4>
                        </div>
                        <p className={`text-3xl font-bold ${summary.company1.revenueGrowth >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                          {summary.company1.revenueGrowth >= 0 ? '+' : ''}{summary.company1.revenueGrowth.toFixed(1)}%
                        </p>
                        <p className="text-sm text-slate-600 mt-1">From {selectedStartYear} to {selectedEndYear}</p>
                      </div>

                      <div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">💵</span>
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Average Net Profit</h4>
                        </div>
                        <p className="text-3xl font-bold text-amber-900">
                          {summary.company1.avgProfit >= 0 ? '+' : ''}{summary.company1.avgProfit.toFixed(1)}%
                        </p>
                        <p className="text-sm text-slate-600 mt-1">Profit margin percentage</p>
                      </div>

                      <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">📊</span>
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Profit Trend</h4>
                        </div>
                        <p className="text-2xl font-bold text-purple-900 capitalize">
                          {summary.company1.profitTrend === 'improving' && '📈 '}
                          {summary.company1.profitTrend === 'declining' && '📉 '}
                          {summary.company1.profitTrend === 'stable' && '➡️ '}
                          {summary.company1.profitTrend}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">Recent profitability pattern</p>
                      </div>

                      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-5 border-2 border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">💡</span>
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Performance Note</h4>
                        </div>
                        <p className="text-base text-slate-700 leading-relaxed">
                          {summary.company1.performanceNote}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Company 2 Summary */}
                  <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-slate-200">
                      <span className="text-4xl">🏢</span>
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">{summary.company2.companyName}</h3>
                        <p className="text-sm text-slate-600 font-semibold mt-1">
                          {summary.company2.segment}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">💰</span>
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Average Revenue</h4>
                        </div>
                        <p className="text-3xl font-bold text-orange-900">
                          {getCurrencySymbol(summary.company2.currency)}{(summary.company2.avgRevenue / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} million
                        </p>
                        <p className="text-sm text-slate-600 mt-1">{getCurrencyName(summary.company2.currency)} per year</p>
                      </div>

                      <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">📈</span>
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Revenue Growth</h4>
                        </div>
                        <p className={`text-3xl font-bold ${summary.company2.revenueGrowth >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                          {summary.company2.revenueGrowth >= 0 ? '+' : ''}{summary.company2.revenueGrowth.toFixed(1)}%
                        </p>
                        <p className="text-sm text-slate-600 mt-1">From {selectedStartYear} to {selectedEndYear}</p>
                      </div>

                      <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">💵</span>
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Average Net Profit</h4>
                        </div>
                        <p className="text-3xl font-bold text-yellow-900">
                          {summary.company2.avgProfit >= 0 ? '+' : ''}{summary.company2.avgProfit.toFixed(1)}%
                        </p>
                        <p className="text-sm text-slate-600 mt-1">Profit margin percentage</p>
                      </div>

                      <div className="bg-gradient-to-r from-pink-50 to-pink-100 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">📊</span>
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Profit Trend</h4>
                        </div>
                        <p className="text-2xl font-bold text-pink-900 capitalize">
                          {summary.company2.profitTrend === 'improving' && '📈 '}
                          {summary.company2.profitTrend === 'declining' && '📉 '}
                          {summary.company2.profitTrend === 'stable' && '➡️ '}
                          {summary.company2.profitTrend}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">Recent profitability pattern</p>
                      </div>

                      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-5 border-2 border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">💡</span>
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Performance Note</h4>
                        </div>
                        <p className="text-base text-slate-700 leading-relaxed">
                          {summary.company2.performanceNote}
                        </p>
                      </div>
                    </div>
                  </div>
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
