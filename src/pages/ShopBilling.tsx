import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/db/supabase'
import { useAuth } from '@/hooks/useAuth'
import { getEgyptYearMonth } from '@/utils/egyptTime'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'

interface PlanData {
  id: string
  name: string
  pricing_type: 'per_transaction' | 'per_service' | 'quota'
  price_per_unit: number | null
  monthly_price: number | null
  quota_limit: number | null
}

interface ShopData {
  id: string
  name: string
  subscription_status: 'active' | 'inactive' | 'suspended'
  subscription_end_date: string | null
  plan_id: string | null
  plan: PlanData | null
}

interface UsageData {
  month: string
  usage: number
}

export const ShopBilling = () => {
  const { t } = useTranslation()
  const { shopId } = useAuth()

  const [shopData, setShopData] = useState<ShopData | null>(null)
  const [usageData, setUsageData] = useState<UsageData[]>([])
  const [currentMonthUsage, setCurrentMonthUsage] = useState(0)
  const [estimatedBill, setEstimatedBill] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (shopId) {
      fetchShopBillingData()
    }
  }, [shopId])

  const fetchShopBillingData = async () => {
    try {
      setLoading(true)

      // Query 1: Get shop data
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, name, subscription_status, subscription_end_date, plan_id')
        .eq('id', shopId!)
        .single()

      if (shopError) throw shopError

      // Query 2: Get plan data separately using plan_id if it exists
      let plan: PlanData | null = null
      if (shop?.plan_id) {
        const { data: planData, error: planError } = await supabase
          .from('plans')
          .select('id, name, pricing_type, price_per_unit, monthly_price, quota_limit')
          .eq('id', shop.plan_id)
          .single()

        if (!planError && planData) {
          plan = planData
        }
      }

      // Build shop data object
      const shopData: ShopData = {
        id: shop.id,
        name: shop.name,
        subscription_status: shop.subscription_status,
        subscription_end_date: shop.subscription_end_date,
        plan_id: shop.plan_id,
        plan,
      }

      setShopData(shopData)

      // Get current month usage (using Egypt timezone)
      const currentYearMonth = getEgyptYearMonth()

      const { data: currentMonthLogs } = await supabase
        .from('usage_logs')
        .select('quantity, billable_amount')
        .eq('shop_id', shopId!)
        .eq('year_month', currentYearMonth)

      const monthUsage = currentMonthLogs?.reduce((sum, log) => sum + (log.quantity || 0), 0) || 0
      const currentMonthBillable = currentMonthLogs?.reduce((sum, log) => sum + (log.billable_amount || 0), 0) || 0
      
      setCurrentMonthUsage(monthUsage)

      // Calculate estimated bill
      if (plan) {
        let bill = 0
        if (plan.pricing_type === 'quota') {
          bill = plan.monthly_price || 0
        } else {
          bill = currentMonthBillable
        }
        setEstimatedBill(bill)
      }

      // Get last 6 months usage
      const monthsData: UsageData[] = []
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const targetYearMonth = String(targetDate.getFullYear()) + '-' + String(targetDate.getMonth() + 1).padStart(2, '0')

        const { data: logs } = await supabase
          .from('usage_logs')
          .select('quantity')
          .eq('shop_id', shopId!)
          .eq('year_month', targetYearMonth)

        const usage = logs?.reduce((sum, log) => sum + (log.quantity || 0), 0) || 0
        monthsData.push({
          month: `${targetDate.getMonth() + 1}/${targetDate.getFullYear()}`,
          usage: usage,
        })
      }

      setUsageData(monthsData)
    } catch (error: any) {
      console.error('Error fetching billing data:', error)
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  // Calculate days left
  const getDaysLeft = () => {
    if (!shopData?.subscription_end_date) return null

    const endDate = shopData.subscription_end_date // YYYY-MM-DD
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }) // YYYY-MM-DD
    
    if (endDate < today) return 0 // Already expired
    
    const end = new Date(endDate)
    const current = new Date(today)
    const diff = end.getTime() - current.getTime()
    const days = Math.ceil(diff / (1000 * 3600 * 24))

    return days
  }

  // Get subscription status color and message
  const getSubscriptionStatus = () => {
    if (!shopData) return null

    const daysLeft = getDaysLeft()

    if (shopData.subscription_status !== 'active') {
      return {
        status: 'expired',
        color: 'bg-red-500/20 border-red-500/30',
        textColor: 'text-red-300',
        icon: AlertCircle,
        message: t('shop.billing.expired'),
      }
    }

    if (daysLeft && daysLeft < 7 && daysLeft > 0) {
      return {
        status: 'expiring',
        color: 'bg-yellow-500/20 border-yellow-500/30',
        textColor: 'text-yellow-300',
        icon: Clock,
        message: t('shop.billing.expiring_soon'),
      }
    }

    return {
      status: 'active',
      color: 'bg-emerald-500/20 border-emerald-500/30',
      textColor: 'text-emerald-300',
      icon: CheckCircle,
      message: t('shop.billing.active'),
    }
  }

  // Get usage percentage for quota plans
  const getUsagePercentage = () => {
    if (!shopData?.plan || shopData.plan.pricing_type !== 'quota') return null

    const quota = shopData.plan.quota_limit || 1
    const percentage = (currentMonthUsage / quota) * 100

    return Math.min(percentage, 100)
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-96'>
        <div className='animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-gold-400'></div>
      </div>
    )
  }

  if (!shopData) {
    return (
      <div className='flex items-center justify-center min-h-96'>
        <div className='text-center'>
          <p className='text-slate-400'>{t('common.error')}</p>
        </div>
      </div>
    )
  }

  const subscriptionStatus = getSubscriptionStatus()
  const usagePercentage = getUsagePercentage()
  const daysLeft = getDaysLeft()
  const StatusIcon = subscriptionStatus?.icon || AlertCircle

  return (
    <div className='space-y-6 pb-8'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold text-white mb-2'>{t('shop.billing.title')}</h1>
        <p className='text-slate-400'>{shopData.name}</p>
      </div>

      {/* Subscription Status Alert */}
      <div
        className={`glass rounded-xl border p-6 ${subscriptionStatus?.color} flex items-start gap-4`}
      >
        <StatusIcon size={24} className={subscriptionStatus?.textColor} />
        <div className='flex-1'>
          <h3 className={`${subscriptionStatus?.textColor} font-semibold mb-1`}>
            {subscriptionStatus?.message}
          </h3>
          {shopData.subscription_end_date && (
            <p className='text-slate-300 text-sm'>
              {t('shop.billing.subscription_end_date')}:{' '}
              {new Date(shopData.subscription_end_date).toLocaleDateString()}
              {daysLeft && daysLeft > 0 && (
                <span className='ml-2 text-slate-400'>({daysLeft} {t('shop.billing.days_left')})</span>
              )}
            </p>
          )}
          {shopData.subscription_status !== 'active' && (
            <p className='text-sm mt-2 opacity-75'>{t('shop.billing.contact_admin')}</p>
          )}
        </div>
      </div>

      {/* Plan Details Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* Current Plan */}
        <div className='glass rounded-xl border border-white/10 p-6'>
          <h3 className='text-sm font-semibold text-slate-200 mb-4'>{t('shop.billing.current_plan')}</h3>
          {shopData.plan ? (
            <div className='space-y-3'>
              <div>
                <p className='text-xs text-slate-400'>{t('common.name')}</p>
                <p className='text-lg font-semibold text-white'>{shopData.plan.name}</p>
              </div>
              <div>
                <p className='text-xs text-slate-400'>{t('shop.billing.pricing_type')}</p>
                <p className='text-white'>
                  {shopData.plan.pricing_type === 'per_transaction'
                    ? t('shop.billing.per_transaction')
                    : shopData.plan.pricing_type === 'per_service'
                      ? t('shop.billing.per_service')
                      : t('shop.billing.quota_plan')}
                </p>
              </div>
              {shopData.plan.pricing_type === 'quota' ? (
                <div>
                  <p className='text-xs text-slate-400'>{t('shop.billing.monthly_price')}</p>
                  <p className='text-lg font-semibold text-gold-400'>{formatCurrency(shopData.plan.monthly_price || 0)}</p>
                  <p className='text-xs text-slate-400 mt-1'>
                    {t('shop.billing.quota_limit')}: {shopData.plan.quota_limit || 0} {t('shop.billing.transactions')}
                  </p>
                </div>
              ) : (
                <div>
                  <p className='text-xs text-slate-400'>{t('shop.billing.price_per_unit')}</p>
                  <p className='text-lg font-semibold text-gold-400'>{formatCurrency(shopData.plan.price_per_unit || 0)}</p>
                </div>
              )}
            </div>
          ) : (
            <div className='space-y-3'>
              <p className='text-slate-300'>{t('shop.billing.no_plan_assigned')}</p>
              <p className='text-xs text-slate-400'>{t('shop.billing.contact_admin_plan')}</p>
            </div>
          )}
        </div>

        {/* Estimated Bill */}
        <div className='glass rounded-xl border border-white/10 p-6'>
          <h3 className='text-sm font-semibold text-slate-200 mb-4'>{t('shop.billing.estimated_bill')}</h3>
          <p className='text-4xl font-bold text-gold-400 mb-2'>{formatCurrency(estimatedBill)}</p>
          <p className='text-xs text-slate-400'>
            {shopData.plan ? (
              shopData.plan.pricing_type === 'quota' 
                ? t('shop.billing.quota_plan') 
                : `${t('shop.billing.usage_this_month')}: ${currentMonthUsage}`
            ) : (
              t('shop.billing.no_plan_assigned')
            )}
          </p>
        </div>
      </div>

      {/* Usage Section */}
      {shopData.plan?.pricing_type === 'quota' && (
        <div className='glass rounded-xl border border-white/10 p-6'>
          <h3 className='text-sm font-semibold text-slate-200 mb-4'>{t('shop.billing.usage_this_month')}</h3>
          <div className='space-y-4'>
            <div>
              <div className='flex justify-between mb-2'>
                <p className='text-white font-medium'>
                  {currentMonthUsage} / {shopData.plan.quota_limit || 0}
                </p>
                <p
                  className={`font-semibold ${
                    usagePercentage && usagePercentage > 100 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {usagePercentage?.toFixed(0)}%
                </p>
              </div>
              <div className='w-full bg-slate-700 rounded-full h-2'>
                <div
                  className={`h-2 rounded-full transition-all ${
                    usagePercentage && usagePercentage > 100 ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(usagePercentage || 0, 100)}%` }}
                />
              </div>
            </div>
            {usagePercentage && usagePercentage > 100 && (
              <div className='bg-red-500/20 border border-red-500/30 rounded-lg p-3'>
                <p className='text-red-300 text-sm'>{t('shop.billing.over_quota')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Usage History Chart */}
      {usageData.length > 0 && (
        <div className='glass rounded-xl border border-white/10 p-6'>
          <h3 className='text-sm font-semibold text-slate-200 mb-4'>{t('shop.billing.usage_history')}</h3>
          <div className='w-full h-80'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={usageData}>
                <CartesianGrid strokeDasharray='3 3' stroke='rgba(255,255,255,0.1)' />
                <XAxis dataKey='month' stroke='rgba(255,255,255,0.5)' />
                <YAxis stroke='rgba(255,255,255,0.5)' />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.7)' }} />
                <Bar dataKey='usage' fill='#D4AF37' name={t('shop.billing.usage_this_month')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
