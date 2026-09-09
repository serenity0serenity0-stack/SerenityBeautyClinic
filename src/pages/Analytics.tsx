import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { useTransactions } from '../db/hooks/useTransactions'
import { useExpenses } from '../db/hooks/useExpenses'
import { getEgyptDateString, getEgyptYearMonth } from '../utils/egyptTime'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export const Analytics: React.FC = () => {
  const { t } = useTranslation()

  const [dateRange, setDateRange] = useState('month')
  const [customFrom, setCustomFrom] = useState(`${getEgyptYearMonth()}-01`)
  const [customTo, setCustomTo] = useState(getEgyptDateString())
  const [selectedDay, setSelectedDay] = useState(getEgyptDateString())

  // Compute date bounds for React Query — hooks fetch only this window
  const { dateFrom, dateTo } = useMemo(() => {
    const today = getEgyptDateString()
    if (dateRange === 'custom') {
      return {
        dateFrom: customFrom || `${getEgyptYearMonth()}-01`,
        dateTo: customTo || today,
      }
    }
    if (dateRange === 'day') {
      return { dateFrom: selectedDay, dateTo: selectedDay }
    }
    const start = new Date()
    switch (dateRange) {
      case 'week': start.setDate(start.getDate() - 7); break
      case 'month': start.setMonth(start.getMonth() - 1); break
      case 'quarter': start.setMonth(start.getMonth() - 3); break
      case 'year': start.setFullYear(start.getFullYear() - 1); break
    }
    return { dateFrom: getEgyptDateString(start), dateTo: today }
  }, [dateRange, customFrom, customTo, selectedDay])

  const { transactions } = useTransactions({ dateFrom, dateTo })
  const { expenses } = useExpenses({ dateFrom, dateTo })

  const [analyticsData, setAnalyticsData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalTransactions: 0,
    uniqueClients: 0,
    avgTicket: 0,
    chartData: [] as any[],
    chartKey: 'date',
  })

  useEffect(() => {
    let chartKey = 'date'

    const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0)
    const totalExpensesAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
    const netProfit = totalRevenue - totalExpensesAmount
    const uniqueClientsCount = new Set(transactions.map((t) => t.client_id)).size

    let chartData: any[] = []

    if (dateRange === 'day') {
      chartKey = 'time'
      const hourly: Record<string, number> = {}
      for (let h = 0; h < 24; h++) {
        hourly[`${String(h).padStart(2, '0')}:00`] = 0
      }
      transactions.forEach((t) => {
        const hour = (t.time || '').slice(0, 2)
        if (hour) hourly[`${hour}:00`] = (hourly[`${hour}:00`] || 0) + t.total
      })
      chartData = Object.entries(hourly).map(([time, income]) => ({ time, income }))
    } else {
      chartData = transactions as any[]
    }

    setAnalyticsData({
      totalRevenue,
      totalExpenses: totalExpensesAmount,
      netProfit,
      totalTransactions: transactions.length,
      uniqueClients: uniqueClientsCount,
      avgTicket: transactions.length > 0 ? totalRevenue / transactions.length : 0,
      chartData,
      chartKey,
    })
  }, [dateRange, transactions, expenses])

  const KPICard = ({ label, value, color = 'gold' }: any) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard>
        <p className="text-sm text-gray-400 mb-2">{label}</p>
        <h3 className={`text-2xl font-bold text-${color}-400`}>{value}</h3>
      </GlassCard>
    </motion.div>
  )

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-3xl font-bold text-white">{t('analytics.title')}</h1>
      </motion.div>

      {/* Date Range Selector */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {['day', 'week', 'month', 'quarter', 'year'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg transition ${
                dateRange === range
                  ? 'bg-gold-400/20 text-gold-400 border border-gold-400/20'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {t(`common.${range}`)}
            </button>
          ))}
          <button
            onClick={() => setDateRange('custom')}
            className={`px-4 py-2 rounded-lg transition ${
              dateRange === 'custom'
                ? 'bg-gold-400/20 text-gold-400 border border-gold-400/20'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {t('analytics.custom_range')}
          </button>
        </div>

        {/* Day picker */}
        {dateRange === 'day' && (
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">اختر اليوم</label>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/40"
              />
            </div>
            <p className="text-xs text-gray-500">{selectedDay}</p>
          </div>
        )}

        {/* Custom From/To date range */}
        {dateRange !== 'day' && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('analytics.from')}</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value)
                  setDateRange('custom')
                }}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/40"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t('analytics.to')}</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value)
                  setDateRange('custom')
                }}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gold-400/40"
              />
            </div>
            <p className="text-xs text-gray-500">
              {dateFrom} → {dateTo}
            </p>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard label={t('analytics.total_revenue')} value={`${analyticsData.totalRevenue.toFixed(2)} ج.م`} />
        <KPICard label={t('analytics.total_expenses')} value={`${analyticsData.totalExpenses.toFixed(2)} ج.م`} />
        <KPICard
          label={t('analytics.net_profit')}
          value={`${analyticsData.netProfit.toFixed(2)} ج.م`}
          color={analyticsData.netProfit >= 0 ? 'green' : 'red'}
        />
        <KPICard label={t('analytics.total_transactions')} value={analyticsData.totalTransactions} />
        <KPICard label={t('analytics.unique_clients')} value={analyticsData.uniqueClients} />
        <KPICard label={t('analytics.average_ticket')} value={`${analyticsData.avgTicket.toFixed(2)} ج.م`} />
      </div>

      {/* Charts */}
      <GlassCard>
        <h2 className="text-lg font-bold text-white mb-4">
          {dateRange === 'day' ? 'الدخل حسب الوقت' : t('analytics.revenue_trend')}
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analyticsData.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey={analyticsData.chartKey} stroke="rgba(255,255,255,0.5)" />
            <YAxis stroke="rgba(255,255,255,0.5)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 15, 35, 0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
            <Line
              type="monotone"
              dataKey={dateRange === 'day' ? 'income' : 'total'}
              stroke="#B794CE"
              dot={dateRange === 'day'}
            />
          </LineChart>
        </ResponsiveContainer>
      </GlassCard>
    </div>
  )
}
