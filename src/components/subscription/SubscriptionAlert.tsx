import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { checkSubscriptionStatus, SubscriptionStatus, getBillingInfo } from '@/utils/subscriptionChecker'
import { AlertCircle, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export const SubscriptionAlert = () => {
  const { clinicId } = useAuth()
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInfo = async () => {
      if (!clinicId) return
      try {
        const sub = await checkSubscriptionStatus(clinicId)
        const bill = await getBillingInfo(clinicId)
        setSubscription(sub)
        setBilling(bill)
      } catch (error) {
        console.error('Error fetching subscription:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInfo()
    const interval = setInterval(fetchInfo, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [clinicId])

  if (loading || !subscription) return null

  if (subscription.status === 'active' && !subscription.isExpiringSoon) {
    return null
  }

  const getAlertConfig = () => {
    switch (subscription.status) {
      case 'expired':
        return {
          icon: AlertCircle,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          title: 'Subscription Expired',
          message: 'Your subscription has expired. Please renew to continue using the service.',
        }
      case 'suspended':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800',
          title: subscription.usagePercentage >= 100 ? 'Quota Exceeded' : 'Subscription Suspended',
          message:
            subscription.usagePercentage >= 100
              ? `You've used ${subscription.quotaUsed}/${subscription.quotaLimit} transactions this month.`
              : 'Your subscription is suspended. Please contact support.',
        }
      case 'inactive':
        return {
          icon: AlertCircle,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          title: 'Subscription Inactive',
          message: 'Your subscription is inactive. Please activate to use the service.',
        }
      default:
        if (subscription.isExpiringSoon) {
          return {
            icon: Clock,
            bgColor: 'bg-yellow-50',
            borderColor: 'border-yellow-200',
            textColor: 'text-yellow-800',
            title: `Subscription Expiring Soon (${subscription.daysRemaining} days)`,
            message: `Your subscription ends on ${
              new Date(billing?.subscriptionEndDate).toLocaleDateString('ar-EG') || 'unknown'
            }. Renew now to avoid disruption.`,
          }
        }
        return null
    }
  }

  const config = getAlertConfig()
  if (!config) return null

  const Icon = config.icon

  return (
    <div className={`${config.bgColor} border-l-4 ${config.borderColor} p-4 mb-4 rounded`}>
      <div className='flex gap-3'>
        <Icon className={`${config.textColor} mt-0.5 flex-shrink-0`} size={20} />
        <div>
          <h3 className={`${config.textColor} font-semibold mb-1`}>{config.title}</h3>
          <p className={`${config.textColor} text-sm`}>{config.message}</p>
          {/* Billing details removed for single-clinic version */}
        </div>
      </div>
    </div>
  )
}

export const SubscriptionStatusBadge = () => {
  const { clinicId } = useAuth()
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)

  useEffect(() => {
    const fetchInfo = async () => {
      if (!clinicId) return
      try {
        const sub = await checkSubscriptionStatus(clinicId)
        setSubscription(sub)
      } catch (error) {
        console.error('Error fetching subscription:', error)
      }
    }

    fetchInfo()
  }, [clinicId])

  if (!subscription) return null

  const statusConfig = {
    active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active', icon: CheckCircle },
    expired: { bg: 'bg-red-100', text: 'text-red-800', label: 'Expired', icon: AlertCircle },
    suspended: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Suspended', icon: AlertTriangle },
    inactive: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Inactive', icon: Clock },
  }

  const config = statusConfig[subscription.status]
  const Icon = config.icon

  return (
    <div className={`${config.bg} ${config.text} px-3 py-1 rounded-full flex items-center gap-2 text-sm font-medium`}>
      <Icon size={14} />
      {config.label}
    </div>
  )
}
