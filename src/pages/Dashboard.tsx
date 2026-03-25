import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { AnimatedCounter } from '../components/ui/AnimatedCounter'
import { Badge } from '../components/ui/Badge'
import { SubscriptionAlert } from '../components/subscription/SubscriptionAlert'
import { useTransactions } from '../db/hooks/useTransactions'
import { useExpenses } from '../db/hooks/useExpenses'
import { appEmitter } from '../utils/eventEmitter'
import { getEgyptDateString } from '../utils/egyptTime'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Users, DollarSign, RefreshCw } from 'lucide-react'

export const Dashboard: React.FC = () => {
  const { t } = useTranslation()
  const { transactions, fetchTransactions, loading: transLoading } = useTransactions()
  const { expenses, fetchExpenses } = useExpenses()
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [todayExpenses, setTodayExpenses] = useState(0)
  const [todayClients, setTodayClients] = useState(0)
  const [monthlyClients, setMonthlyClients] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>('')

  // Fetch data immediately on mount
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('Dashboard: Initial load started')
      try {
        await fetchTransactions()
        await fetchExpenses()
        console.log('Dashboard: Initial data loaded successfully')
      } catch (err: any) {
        console.error('Dashboard: Error loading initial data:', err)
      }
    }

    loadInitialData()
  }, [])

  // Listen for new transactions
  useEffect(() => {
    const handleNewTransaction = async () => {
      console.log('Dashboard: New transaction event received, refreshing...')
      setIsRefreshing(true)
      try {
        await fetchTransactions()
        await fetchExpenses()
        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour12: true }))
        console.log('Dashboard: Data refreshed successfully')
      } catch (err: any) {
        console.error('Dashboard: Error refreshing data:', err)
      } finally {
        setIsRefreshing(false)
      }
    }

    appEmitter.on('transaction:created', handleNewTransaction)
    console.log('Dashboard: Event listener attached for transaction:created')

    return () => {
      appEmitter.off('transaction:created', handleNewTransaction)
    }
  }, [fetchTransactions, fetchExpenses])

  // Calculate all statistics whenever data changes
  useEffect(() => {
    if (!transactions || transactions.length === 0) {
      setTodayRevenue(0)
      setTodayClients(0)
      setMonthlyClients(0)
      setRecentTransactions([])
      return
    }

    const today = getEgyptDateString()
    const currentMonth = today.slice(0, 7)

    const todayTx = transactions.filter((t) => {
      if (!t || !t.date) return false
      return String(t.date).slice(0, 10) === today
    })

    const revenue = todayTx.reduce((sum, t) => sum + (Number(t.total) || 0), 0)
    const todayClientIds = new Set(todayTx.map((t) => t.client_id).filter(Boolean))
    const monthTx = transactions.filter((t) => {
      if (!t || !t.date) return false
      return String(t.date).slice(0, 10).startsWith(currentMonth)
    })
    const monthlyClientIds = new Set(monthTx.map((t) => t.client_id).filter(Boolean))

    setTodayRevenue(revenue)
    setTodayClients(todayClientIds.size)
    setMonthlyClients(monthlyClientIds.size)
    setRecentTransactions([...transactions].slice(0, 5))
    
    console.log('Stats updated: Revenue:', revenue, 'Today Clients:', todayClientIds.size, 'Loading:', transLoading)
  }, [transactions, transLoading])

  // Calculate expenses whenever they change
  useEffect(() => {
    if (!expenses || expenses.length === 0) {
      setTodayExpenses(0)
      return
    }

    const today = getEgyptDateString()
    const todayExp = expenses.filter((e) => e && e.date === today)
    const expAmount = todayExp.reduce((sum, e) => sum + (e.amount || 0), 0)
    setTodayExpenses(expAmount)

    console.log('Today expenses:', todayExp.length, 'Amount:', expAmount)
  }, [expenses])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      console.log('Dashboard: Manual refresh started')
      await fetchTransactions()
      await fetchExpenses()
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour12: true }))
      console.log('Dashboard: Manual refresh completed')
    } catch (err: any) {
      console.error('Dashboard: Manual refresh error:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const loading = transLoading || isRefreshing

  console.log('Dashboard render: transLoading=', transLoading, 'isRefreshing=', isRefreshing, 'loading=', loading)

  const KPICard = ({ title, value, icon: Icon, suffix = '' }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="h-full"
    >
      <GlassCard>
        <div className="flex flex-col justify-between h-full">
          <p className="text-sm text-gray-400 mb-3">{title}</p>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl md:text-3xl font-bold text-gold-400">
                {loading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full"
                  />
                ) : (
                  <AnimatedCounter value={value} duration={1} suffix={suffix} />
                )}
              </div>
            </div>
            <div className="p-2 md:p-3 bg-gold-400/10 rounded-lg">
              <Icon className="text-gold-400" size={20} />
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )

  return (
    <div className="space-y-4 md:space-y-6 px-3 md:px-0">
      {/* Subscription Alert */}
      <SubscriptionAlert />

      {/* Page Title with Refresh Button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center justify-between gap-2"
      >
        <h1 className="text-2xl md:text-3xl font-bold text-white">{t('dashboard.title')}</h1>
        <motion.button
          onClick={handleManualRefresh}
          disabled={loading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg hover:bg-gold-400/30 disabled:opacity-50 transition text-xs md:text-sm"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{t('common.refresh')}</span>
        </motion.button>
      </motion.div>

      {/* Info */}
      <div className="text-xs text-gray-400 flex justify-between items-center">
        <span>{t('dashboard.transactions')}: {transactions?.length || 0} | {t('dashboard.expenses')}: {expenses?.length || 0}</span>
        {lastUpdated && <span>{t('dashboard.last_updated')}: {lastUpdated}</span>}
      </div>

      {/* KPI Cards - Grid Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <KPICard
          title={t('dashboard.today_revenue')}
          value={todayRevenue}
          icon={DollarSign}
          suffix=" ج.م"
        />
        <KPICard
          title={t('dashboard.clients_today')}
          value={todayClients}
          icon={Users}
        />
        <KPICard
          title={t('dashboard.clients_this_month')}
          value={monthlyClients}
          icon={Users}
        />
        <KPICard
          title={t('dashboard.today_expenses')}
          value={todayExpenses}
          icon={TrendingDown}
          suffix=" ج.م"
        />
        <KPICard
          title={t('dashboard.daily_net')}
          value={todayRevenue - todayExpenses}
          icon={TrendingUp}
          suffix=" ج.م"
        />
      </div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <GlassCard>
          <h2 className="text-lg md:text-xl font-bold text-white mb-4">{t('dashboard.last_transactions')}</h2>
          <div className="space-y-2 md:space-y-3">
            {recentTransactions && recentTransactions.length > 0 ? (
              recentTransactions.map((tx, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-2 md:p-3 bg-white/5 rounded-lg hover:bg-white/10 transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold text-sm md:text-base truncate">
                      {tx.clientName || t('dashboard.unknown_client')}
                    </p>
                    <p className="text-xs md:text-xs text-gray-400">
                      {tx.date} {tx.time}
                    </p>
                  </div>
                  <Badge label={`${(tx.total || 0).toFixed(2)} ج.م`} variant="gold" />
                </motion.div>
              ))
            ) : (
              <p className="text-center text-gray-400 py-6">{t('dashboard.no_transactions')}</p>
            )}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  )
}
