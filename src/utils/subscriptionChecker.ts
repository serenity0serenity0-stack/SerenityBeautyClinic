import { supabase } from '@/db/supabase'
import { getEgyptDateString } from './egyptTime'

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
    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('status, expires_at')
      .eq('clinic_id', clinicId)
      .single()

    if (fetchError) throw fetchError
    if (!subscription) return

    // Use Egypt timezone for comparison
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at).toISOString().split('T')[0] : null
    const today = getEgyptDateString() // YYYY-MM-DD in Egypt timezone
    const isExpired = expiresAt && expiresAt < today

    // If subscription has expired and status is still 'active', update it to 'expired'
    if (isExpired && subscription.status === 'active') {
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('clinic_id', clinicId)

      if (updateError) throw updateError
      console.log(`✅ Clinic ${clinicId} subscription automatically expired`)
    }
  } catch (error) {
    console.error('Error auto-expiring subscription:', error)
    // Don't throw - this is a background operation
  }
}

/**
 * Check subscription status for a clinic
 */
export const checkSubscriptionStatus = async (
  clinicId: string
): Promise<SubscriptionStatus> => {
  try {
    // First, auto-expire if needed
    await autoExpireSubscriptions(clinicId)

    // Get subscription details
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, plan, status, expires_at')
      .eq('clinic_id', clinicId)
      .single()

    if (subError) throw subError
    if (!subscription) throw new Error('Subscription not found')

    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at).toISOString().split('T')[0] : null
    const today = getEgyptDateString() // YYYY-MM-DD in Egypt timezone
    
    // Calculate days remaining by comparing date strings
    let daysRemaining = 0
    if (expiresAt && expiresAt >= today) {
      const end = new Date(expiresAt)
      const current = new Date(today)
      daysRemaining = Math.ceil((end.getTime() - current.getTime()) / (1000 * 60 * 60 * 24))
    }
    
    const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7
    const isExpired = expiresAt ? expiresAt < today : false

    // Determine subscription status
    let status: 'active' | 'inactive' | 'suspended' | 'expired' = 'active'
    if (subscription.status === 'suspended') {
      status = 'suspended'
    } else if (isExpired) {
      status = 'expired'
    } else if (subscription.status === 'inactive') {
      status = 'inactive'
    }

    return {
      isActive: status === 'active',
      status,
      daysRemaining: Math.max(0, daysRemaining),
      isExpiringSoon,
      currentPlan: subscription.plan || 'professional',
      quotaUsed: 0,
      quotaLimit: 0,
      usagePercentage: 0,
    }
  } catch (error) {
    console.error('Error checking subscription:', error)
    throw error
  }
}

/**
 * Get billing info for a clinic
 */
export const getBillingInfo = async (clinicId: string) => {
  try {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status, expires_at')
      .eq('clinic_id', clinicId)
      .single()

    if (!subscription) throw new Error('Subscription not found')

    return {
      plan: subscription.plan || 'professional',
      pricingType: 'subscription',
      currentMonthBill: 0,
      monthlyPrice: 0,
      pricePerUnit: 0,
      quotaLimit: 0,
      currentMonthUsage: 0,
      currentMonthActions: 0,
      subscriptionStatus: subscription.status,
      subscriptionEndDate: subscription.expires_at?.split('T')[0] || null,
    }
  } catch (error) {
    console.error('Error getting billing info:', error)
    throw error
  }
}
