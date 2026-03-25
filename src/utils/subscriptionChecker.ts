import { supabase } from '@/db/supabase'
import { getEgyptDateString, getEgyptYearMonth } from './egyptTime'

export interface SubscriptionStatus {
  isActive: boolean
  status: 'active' | 'inactive' | 'suspended' | 'expired'
  daysRemaining: number
  isExpiringSoon: boolean
  currentPlan: string
  quotaUsed: number
  quotaLimit: number
  usagePercentage: number
}

/**
 * Auto-expire subscriptions that have passed their end date (using Egypt timezone)
 */
export const autoExpireSubscriptions = async (clinicId: string): Promise<void> => {
  try {
    const { data: shop, error: fetchError } = await supabase
      .from('shops')
      .select('subscription_status, subscription_end_date')
      .eq('id', clinicId)
      .single()

    if (fetchError) throw fetchError
    if (!shop) return

    // Use Egypt timezone for comparison
    const endDate = shop.subscription_end_date // format: YYYY-MM-DD
    const today = getEgyptDateString() // YYYY-MM-DD in Egypt timezone
    const isExpired = endDate && endDate < today

    // If subscription has expired and status is still 'active', update it to 'expired'
    if (isExpired && shop.subscription_status === 'active') {
      const { error: updateError } = await supabase
        .from('shops')
        .update({ subscription_status: 'expired' })
        .eq('id', clinicId)

      if (updateError) throw updateError
      console.log(`✅ Shop ${clinicId} automatically expired`)
    }
  } catch (error) {
    console.error('Error auto-expiring subscription:', error)
    // Don't throw - this is a background operation
  }
}

/**
 * Check subscription status for a shop
 */
export const checkSubscriptionStatus = async (
  clinicId: string
): Promise<SubscriptionStatus> => {
  try {
    // First, auto-expire if needed
    await autoExpireSubscriptions(clinicId)

    // Get shop details
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select(`
        id,
        subscription_status,
        subscription_end_date,
        plan_id,
        plans (
          id,
          name,
          pricing_type,
          quota_limit,
          monthly_price
        )
      `)
      .eq('id', clinicId)
      .single()

    if (shopError) throw shopError
    if (!shop) throw new Error('Shop not found')

    const plan = shop.plans as any
    const endDate = shop.subscription_end_date // YYYY-MM-DD format
    const today = getEgyptDateString() // YYYY-MM-DD in Egypt timezone
    
    // Calculate days remaining by comparing date strings
    let daysRemaining = 0
    if (endDate && endDate >= today) {
      const end = new Date(endDate)
      const current = new Date(today)
      daysRemaining = Math.ceil((end.getTime() - current.getTime()) / (1000 * 60 * 60 * 24))
    }
    
    const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7
    const isExpired = endDate ? endDate < today : false

    // Calculate quota usage for quota plans
    let quotaUsed = 0
    let quotaLimit = plan?.quota_limit || 0
    let usagePercentage = 0

    if (plan?.pricing_type === 'quota') {
      // Get current month's usage (using Egypt timezone)
      const yearMonth = getEgyptYearMonth()

      const { data: usageLogs, error: usageError } = await supabase
        .from('usage_logs')
        .select('quantity')
        .eq('shop_id', clinicId)
        .eq('year_month', yearMonth)

      if (!usageError && usageLogs) {
        quotaUsed = usageLogs.reduce((sum, log) => sum + (log.quantity || 0), 0)
        usagePercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0
      }
    }

    // Determine subscription status
    let status: 'active' | 'inactive' | 'suspended' | 'expired' = 'active'
    if (shop.subscription_status === 'suspended') {
      status = 'suspended'
    } else if (isExpired) {
      status = 'expired'
    } else if (shop.subscription_status === 'inactive') {
      status = 'inactive'
    } else if (isExpiringSoon) {
      status = 'active' // Still active, but alert will be shown
    } else if (plan?.pricing_type === 'quota' && quotaUsed >= quotaLimit) {
      status = 'suspended' // Quota exceeded
    }

    return {
      isActive: status === 'active',
      status,
      daysRemaining: Math.max(0, daysRemaining),
      isExpiringSoon,
      currentPlan: plan?.name || 'No Plan',
      quotaUsed,
      quotaLimit,
      usagePercentage,
    }
  } catch (error) {
    console.error('Error checking subscription:', error)
    throw error
  }
}

/**
 * Get billing info for a shop
 */
export const getBillingInfo = async (clinicId: string) => {
  try {
    const { data: shop } = await supabase
      .from('shops')
      .select(`
        id,
        subscription_status,
        subscription_end_date,
        plan_id,
        plans (
          id,
          name,
          pricing_type,
          price_per_unit,
          quota_limit,
          monthly_price
        )
      `)
      .eq('id', clinicId)
      .single()

    if (!shop) throw new Error('Shop not found')

    const plan = shop.plans as any
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const yearMonth = `${year}-${month}`

    // Get current month's usage logs
    const { data: usageLogs } = await supabase
      .from('usage_logs')
      .select('quantity, billable_amount, action_type')
      .eq('shop_id', clinicId)
      .eq('year_month', yearMonth)

    const totalTransactions = usageLogs?.filter(log => log.action_type === 'transaction').length || 0
    const totalActions = usageLogs?.length || 0
    const totalBilled = usageLogs?.reduce((sum, log) => sum + (log.billable_amount || 0), 0) || 0

    return {
      plan: plan?.name || 'No Plan',
      pricingType: plan?.pricing_type || null,
      currentMonthBill: totalBilled,
      monthlyPrice: plan?.monthly_price || 0,
      pricePerUnit: plan?.price_per_unit || 0,
      quotaLimit: plan?.quota_limit || 0,
      currentMonthUsage: totalTransactions,
      currentMonthActions: totalActions,
      subscriptionStatus: shop.subscription_status,
      subscriptionEndDate: shop.subscription_end_date,
    }
  } catch (error) {
    console.error('Error getting billing info:', error)
    throw error
  }
}
