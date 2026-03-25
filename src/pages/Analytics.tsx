import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { useTransactions } from '../db/hooks/useTransactions'
import { useExpenses } from '../db/hooks/useExpenses'
import { getEgyptDateString } from '../utils/egyptTime'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export const Analytics: React.FC = () => {
  const { t } = useTranslation()
  const { transactions } = useTransactions()
  const { expenses } = useExpenses()

  const [dateRange, setDateRange] = useState('month')
  const [analyticsData, setAnalyticsData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalTransactions: 0,
    uniqueClients: 0,
    avgTicket: 0,
    chartData: [],
  })

  useEffect(() => {
    const today = new Date()
    let startDate = new Date()

    switch (dateRange) {
      case 'week':
        startDate.setDate(today.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(today.getMonth() - 1)
        break
      case 'quarter':
        startDate.setMonth(today.getMonth() - 3)
        break
      case 'year':
        startDate.setFullYear(today.getFullYear() - 1)
        break
      default:
        break
    }

    const startDateStr = getEgyptDateString(startDate)
    const endDateStr = getEgyptDateString(today)

    // Filter transactions and expenses for date range
    const filteredTransactions = transactions.filter(
      (t) => t.date >= startDateStr && t.date <= endDateStr
    )
    const filteredExpenses = expenses.filter(
      (e) => e.date >= startDateStr && e.date <= endDateStr
    )

    const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.total, 0)
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)
    const netProfit = totalRevenue - totalExpenses
    const uniqueClientsCount = new Set(filteredTransactions.map((t) => t.client_id)).size

    setAnalyticsData({
      totalRevenue,
      totalExpenses,
      netProfit,
      totalTransactions: filteredTransactions.length,
      uniqueClients: uniqueClientsCount,
      avgTicket: filteredTransactions.length > 0 ? totalRevenue / filteredTransactions.length : 0,
      chartData: filteredTransactions as any,
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
      <div className="flex gap-2 flex-wrap">
        {['week', 'month', 'quarter', 'year'].map((range) => (
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
        <h2 className="text-lg font-bold text-white mb-4">{t('analytics.revenue_trend')}</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analyticsData.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
            <YAxis stroke="rgba(255,255,255,0.5)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 15, 35, 0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
            <Line type="monotone" dataKey="total" stroke="#D4AF37" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </GlassCard>
    </div>
  )
}
