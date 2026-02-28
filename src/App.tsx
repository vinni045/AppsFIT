import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface FinancialData {
  year: number
  [key: string]: number | string
}

interface CompanyFinancials {
  company_name: string
  year: number
  'Net Revenue': number
  'Cost of Goods': number
  'Total Assets': number
  'Gross Margin': number
  'Operating Profit': number
  'Net Profit': number
}

const METRICS = [
  { key: 'Net Revenue', label: 'Revenue' },
  { key: 'Cost of Goods', label: 'Cost of Goods' },
  { key: 'Total Assets', label: 'Assets' },
  { key: 'Gross Margin', label: 'Gross Margin' },
  { key: 'Operating Profit', label: 'Operating Profit' },
  { key: 'Net Profit', label: 'Net Profit' },
]

function App() {
  const [companies, setCompanies] = useState<string[]>([])
  const [company1, setCompany1] = useState<string>('')
  const [company2, setCompany2] = useState<string>('')
  const [startYear, setStartYear] = useState(2020)
  const [endYear, setEndYear] = useState(2024)
  const [chartData, setChartData] = useState<FinancialData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCompanyList()
  }, [])

  const fetchCompanyList = () => {
    const query = `SELECT DISTINCT company_name FROM financials ORDER BY company_name`
    const url = `https://www.dolthub.com/api/v1alpha1/calvinw/BusMgmtBenchmarks?q=${encodeURIComponent(query)}`

    fetch(url)
      .then(res => res.json())
      .then(data => {
        const companyNames = data.rows.map((row: { company_name: string }) => row.company_name)
        setCompanies(companyNames)
        if (companyNames.length >= 2) {
          setCompany1(companyNames[0])
          setCompany2(companyNames[1])
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

    const query = `
      SELECT f.company_name, f.year, f.\`Net Revenue\`, f.\`Cost of Goods\`, 
             f.\`Total Assets\`, f.\`Gross Margin\`, f.\`Operating Profit\`, f.\`Net Profit\`
      FROM financials f
      WHERE (f.company_name = '${company1}' OR f.company_name = '${company2}')
      AND f.year BETWEEN ${startYear} AND ${endYear}
      ORDER BY f.year
    `
    const url = `https://www.dolthub.com/api/v1alpha1/calvinw/BusMgmtBenchmarks?q=${encodeURIComponent(query)}`

    fetch(url)
      .then(res => res.json())
      .then(data => {
        const financials = data.rows as CompanyFinancials[]
        const chartDataByYear: { [year: number]: any } = {}

        financials.forEach(row => {
          if (!chartDataByYear[row.year]) {
            chartDataByYear[row.year] = { year: row.year }
          }
          METRICS.forEach(metric => {
            const key = `${row.company_name} - ${metric.label}`
            chartDataByYear[row.year][key] = row[metric.key as keyof CompanyFinancials] || 0
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
        <p className="text-center text-gray-600 mb-8">Compare financial metrics between two companies across multiple years</p>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div>
              <label htmlFor="company1-select" className="block text-sm font-semibold mb-2">Company 1</label>
              <select
                id="company1-select"
                value={company1}
                onChange={e => setCompany1(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Company</option>
                {companies.map(c => (
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
                {companies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="start-year-select" className="block text-sm font-semibold mb-2">Start Year</label>
              <select
                id="start-year-select"
                value={startYear}
                onChange={e => setStartYear(Number(e.target.value))}
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
                value={endYear}
                onChange={e => setEndYear(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2018, 2019, 2020, 2021, 2022, 2023, 2024].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={fetchComparisonData}
            disabled={loading || !company1 || !company2}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {loading ? 'Loading...' : 'Compare Companies'}
          </button>

          {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
        </div>

        {chartData.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Financial Metrics Comparison</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {METRICS.map(metric => (
                <div key={metric.key} className="bg-white rounded-lg shadow-lg p-8">
                  <h3 className="text-xl font-semibold mb-4">{metric.label}</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottomRight', offset: -5 }} />
                      <YAxis label={{ value: 'USD (thousands)', angle: -90, position: 'left' }} />
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
          </div>
        )}
      </div>
    </div>
  )
}

export default App
