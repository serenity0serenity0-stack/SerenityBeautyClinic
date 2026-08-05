import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/db/supabase'
import { getEgyptYearMonth } from '@/utils/egyptTime'
import toast from 'react-hot-toast'
import { Download } from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'

interface ShopBilling {
  shop_id: string
  shop_name: string
  owner_email: string
  plan_name: string
  pricing_type: 'per_transaction' | 'per_service' | 'quota'
  price_per_unit: number | null
  monthly_price: number | null
  quota_limit: number | null
  usage_count: number
  billable_amount: number
  is_over_quota: boolean
}

export const AdminBilling = () => {
  const { t } = useTranslation()

  const [billings, setBillings] = useState<ShopBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [totalRevenue, setTotalRevenue] = useState(0)

  useEffect(() => {
    fetchBillingData()
  }, [])

  const fetchBillingData = async () => {
    try {
      setLoading(true)

      // Get current month in Egypt timezone (YYYY-MM format)
      const yearMonth = getEgyptYearMonth()

      // Fetch all shops with their plans
      const { data: shopsData, error: shopsError } = await supabase
        .from('shops')
        .select(`
          id,
          name,
          owner_email,
          plan_id,
          plans (
            name,
            pricing_type,
            price_per_unit,
            monthly_price,
            quota_limit
          )
        `)
        .order('created_at', { ascending: false })

      if (shopsError) throw shopsError

      // For each shop, get usage data
      const billingData: ShopBilling[] = []
      let totalAmount = 0

      for (const shop of shopsData || []) {
        // Get usage for current month (using year_month field)
        const { data: usageLogs } = await supabase
          .from('usage_logs')
          .select('billable_amount, quantity')
          .eq('shop_id', shop.id)
          .eq('year_month', yearMonth)

        const actualUsageCount = usageLogs?.reduce((sum, log) => sum + (log.quantity || 0), 0) || 0
        const totalBillable = usageLogs?.reduce((sum, log) => sum + (log.billable_amount || 0), 0) || 0
        const isOverQuota = shop.plans?.[0]?.quota_limit ? actualUsageCount > shop.plans[0].quota_limit : false

        billingData.push({
          shop_id: shop.id,
          shop_name: shop.name,
          owner_email: shop.owner_email,
          plan_name: shop.plans?.[0]?.name || 'No Plan',
          pricing_type: (shop.plans?.[0]?.pricing_type || 'per_transaction') as
            | 'per_transaction'
            | 'per_service'
            | 'quota',
          price_per_unit: shop.plans?.[0]?.price_per_unit || null,
          monthly_price: shop.plans?.[0]?.monthly_price || null,
          quota_limit: shop.plans?.[0]?.quota_limit || null,
          usage_count: actualUsageCount,
          billable_amount: totalBillable,
          is_over_quota: isOverQuota,
        })

        totalAmount += totalBillable
      }

      setBillings(billingData)
      setTotalRevenue(totalAmount)
    } catch (error: any) {
      console.error('Error fetching billing data:', error)
      toast.error(t('admin.billing.error_fetch') || 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }

  // Export to CSV
  const handleExportCSV = () => {
    try {
      const headers = [
        t('admin.billing.shop_name'),
        t('common.email'),
        t('admin.billing.plan'),
        t('admin.billing.pricing_type'),
        t('admin.billing.usage_this_month'),
        t('admin.billing.amount_due'),
      ]

      const rows = billings.map(b => [
        b.shop_name,
        b.owner_email,
        b.plan_name,
        b.pricing_type === 'per_transaction'
          ? t('admin.plans.per_transaction')
          : b.pricing_type === 'per_service'
            ? t('admin.plans.per_service')
            : t('admin.plans.quota'),
        b.usage_count.toString(),
        b.billable_amount.toFixed(2),
      ])

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      const now = new Date()
      const filename = `billing_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.csv`

      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.click()

      toast.success(t('admin.billing.export_csv'))
    } catch (error) {
      console.error('Error exporting CSV:', error)
      toast.error('Failed to export CSV')
    }
  }

  const getPricingTypeLabel = (type: string) => {
    switch (type) {
      case 'per_transaction':
        return t('admin.plans.per_transaction')
      case 'per_service':
        return t('admin.plans.per_service')
      case 'quota':
        return t('admin.plans.quota')
      default:
        return type
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
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-white mb-2'>{t('admin.billing.title')}</h1>
          <p className='text-slate-400'>{t('admin.billing.description')}</p>
        </div>
        <button
          onClick={handleExportCSV}
          className='px-6 py-3 bg-gradient-to-r from-gold-400 to-gold-500 text-slate-900 font-semibold rounded-lg hover:shadow-lg hover:shadow-gold-400/30 transition flex items-center gap-2'
        >
          <Download size={20} />
          {t('admin.billing.export_csv')}
        </button>
      </div>

      {/* Total Revenue Card */}
      <div className='glass rounded-xl border border-white/10 p-6'>
        <p className='text-slate-400 text-sm mb-2'>{t('admin.dashboard.monthly_revenue')}</p>
        <p className='text-4xl font-bold text-gold-400'>{formatCurrency(totalRevenue)}</p>
      </div>

      {/* Billing Table */}
      <div className='glass rounded-xl overflow-hidden border border-white/10'>
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr className='border-b border-white/10 bg-white/5'>
                <th className='px-6 py-4 text-sm font-semibold text-slate-200'>
                  {t('admin.billing.shop_name')}
                </th>
                <th className='px-6 py-4 text-sm font-semibold text-slate-200'>
                  {t('common.email')}
                </th>
                <th className='px-6 py-4 text-sm font-semibold text-slate-200'>
                  {t('admin.billing.plan')}
                </th>
                <th className='px-6 py-4 text-sm font-semibold text-slate-200'>
                  {t('admin.billing.pricing_type')}
                </th>
                <th className='px-6 py-4 text-sm font-semibold text-slate-200'>
                  {t('admin.billing.usage_this_month')}
                </th>
                <th className='px-6 py-4 text-sm font-semibold text-slate-200'>
                  {t('admin.billing.amount_due')}
                </th>
              </tr>
            </thead>
            <tbody>
              {billings.length === 0 ? (
                <tr>
                  <td colSpan={6} className='px-6 py-12 text-center'>
                    <p className='text-slate-400'>{t('admin.billing.no_data')}</p>
                  </td>
                </tr>
              ) : (
                billings.map(billing => (
                  <tr key={billing.shop_id} className='border-b border-white/5 hover:bg-white/5 transition'>
                    <td className='px-6 py-4 text-white font-medium'>{billing.shop_name}</td>
                    <td className='px-6 py-4 text-slate-300 text-sm'>{billing.owner_email}</td>
                    <td className='px-6 py-4 text-slate-300 text-sm'>{billing.plan_name}</td>
                    <td className='px-6 py-4'>
                      <span className='text-slate-300 text-sm'>{getPricingTypeLabel(billing.pricing_type)}</span>
                    </td>
                    <td className='px-6 py-4'>
                      <div className='flex items-center gap-2'>
                        <span className='text-white font-medium'>{billing.usage_count}</span>
                        {billing.is_over_quota && (
                          <span className='px-2 py-1 bg-red-500/20 text-red-300 text-xs font-semibold rounded border border-red-500/30'>
                            {t('admin.billing.over_quota')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <span className='text-gold-400 font-semibold'>
                        {formatCurrency(billing.billable_amount)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Footer */}
      {billings.length > 0 && (
        <div className='glass rounded-xl border border-white/10 p-6 flex items-center justify-between'>
          <div>
            <p className='text-slate-400 text-sm'>{t('admin.dashboard.total_revenue')}</p>
            <p className='text-2xl font-bold text-white'>{formatCurrency(totalRevenue)}</p>
          </div>
          <div>
            <p className='text-slate-400 text-sm'>{t('common.all')}</p>
            <p className='text-2xl font-bold text-slate-200'>{billings.length}</p>
          </div>
        </div>
      )}
    </div>
  )
}
