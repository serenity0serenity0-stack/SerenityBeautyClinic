import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/db/supabase'
import toast from 'react-hot-toast'
import { ArrowUpRight, Users, TrendingUp, DollarSign, Plus, Eye } from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'

interface ShopSummary {
  id: string
  name: string
  owner_email: string
  subscription_status: 'active' | 'inactive' | 'suspended'
  created_at: string
}

export const AdminDashboard = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    totalShops: 0,
    activeShops: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
  })
  const [recentShops, setRecentShops] = useState<ShopSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Get all shops
      const { data: shops, error: shopsError } = await supabase
        .from('shops')
        .select('id, name, owner_email, subscription_status, created_at')
        .order('created_at', { ascending: false })

      if (shopsError) throw shopsError

      // Get 5 most recent shops
      setRecentShops((shops || []).slice(0, 5))

      // Get current month start and end
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      // Get monthly revenue (sum of billable amounts from all shops this month)
      const { data: monthlyUsageLogs, error: monthlyError } = await supabase
        .from('usage_logs')
        .select('billable_amount')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())

      if (monthlyError) throw monthlyError

      const monthlyRev = monthlyUsageLogs?.reduce((sum, log) => sum + (log.billable_amount || 0), 0) || 0

      // Get all time revenue
      const { data: allUsageLogs, error: allUsageError } = await supabase
        .from('usage_logs')
        .select('billable_amount')

      if (allUsageError) throw allUsageError

      const totalRev = allUsageLogs?.reduce((sum, log) => sum + (log.billable_amount || 0), 0) || 0

      setStats({
        totalShops: shops?.length || 0,
        activeShops: shops?.filter(s => s.subscription_status === 'active').length || 0,
        totalRevenue: totalRev,
        monthlyRevenue: monthlyRev,
      })
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error)
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({
    title,
    value,
    icon: Icon,
    format = 'text',
  }: {
    title: string
    value: number | string
    icon: any
    format?: 'text' | 'currency'
  }) => (
    <div className='glass rounded-xl p-6 border border-white/10 hover:border-gold-400/30 transition'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-slate-300 text-sm font-medium'>{title}</h3>
        <Icon className='text-gold-400' size={24} />
      </div>
      <div className='flex items-baseline gap-2'>
        <p className='text-3xl font-bold text-white'>
          {format === 'currency' ? formatCurrency(Number(value)) : value}
        </p>
      </div>
      <p className='text-slate-400 text-xs mt-2 flex items-center gap-1'>
        <ArrowUpRight size={12} className='text-emerald-400' />
        {t('common.all')}
      </p>
    </div>
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'suspended':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-96'>
        <div className='animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-gold-400'></div>
      </div>
    )
  }

  return (
    <div className='space-y-6 pb-8'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold text-white mb-2'>{t('admin.dashboard.title')}</h1>
        <p className='text-slate-400'>{t('admin.dashboard.total_revenue')} & {t('admin.dashboard.total_shops')}</p>
      </div>

      {/* Stats Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        <StatCard
          title={t('admin.dashboard.total_shops')}
          value={stats.totalShops}
          icon={Users}
          format='text'
        />
        <StatCard
          title={t('admin.dashboard.active_shops')}
          value={stats.activeShops}
          icon={TrendingUp}
          format='text'
        />
        <StatCard
          title={t('admin.dashboard.total_revenue')}
          value={stats.totalRevenue}
          icon={DollarSign}
          format='currency'
        />
        <StatCard
          title={t('admin.dashboard.monthly_revenue')}
          value={stats.monthlyRevenue}
          icon={DollarSign}
          format='currency'
        />
      </div>

      {/* Quick Actions */}
      <div className='glass rounded-xl border border-white/10 p-6'>
        <h2 className='text-lg font-semibold text-white mb-4'>{t('admin.dashboard.quick_actions')}</h2>
        <div className='flex flex-wrap gap-3'>
          <button
            onClick={() => navigate('/admin/shops')}
            className='px-6 py-3 bg-gradient-to-r from-gold-400 to-gold-500 text-slate-900 font-semibold rounded-lg hover:shadow-lg hover:shadow-gold-400/30 transition flex items-center gap-2'
          >
            <Plus size={20} />
            {t('admin.dashboard.create_shop')}
          </button>
          <button
            onClick={() => navigate('/admin/shops')}
            className='px-6 py-3 border border-white/20 text-slate-200 font-semibold rounded-lg hover:bg-white/5 transition flex items-center gap-2'
          >
            <Eye size={20} />
            {t('admin.dashboard.view_all_shops')}
          </button>
        </div>
      </div>

      {/* Recent Shops */}
      <div className='glass rounded-xl border border-white/10 overflow-hidden'>
        <div className='p-6 border-b border-white/10'>
          <h2 className='text-lg font-semibold text-white'>{t('admin.dashboard.recent_shops')}</h2>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr className='border-b border-white/10 bg-white/5'>
                <th className='px-6 py-4 text-left text-sm font-semibold text-slate-200'>{t('common.name')}</th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-slate-200'>{t('common.email')}</th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-slate-200'>{t('admin.shops.subscription_status')}</th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-slate-200'>{t('common.date')}</th>
              </tr>
            </thead>
            <tbody>
              {recentShops.length === 0 ? (
                <tr>
                  <td colSpan={4} className='px-6 py-8 text-center'>
                    <p className='text-slate-400'>{t('admin.shops.no_shops')}</p>
                  </td>
                </tr>
              ) : (
                recentShops.map(shop => (
                  <tr key={shop.id} className='border-b border-white/5 hover:bg-white/5 transition'>
                    <td className='px-6 py-4 text-white font-medium'>{shop.name}</td>
                    <td className='px-6 py-4 text-slate-300 text-sm'>{shop.owner_email}</td>
                    <td className='px-6 py-4'>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(shop.subscription_status)}`}>
                        {t(`admin.shops.${shop.subscription_status}`)}
                      </span>
                    </td>
                    <td className='px-6 py-4 text-slate-300 text-sm'>
                      {new Date(shop.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
