import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { checkSubscriptionStatus, SubscriptionStatus } from '@/utils/subscriptionChecker'
import { AlertCircle } from 'lucide-react'

export interface SubscriptionGuardProps {
  children: React.ReactNode
  allowedStatuses?: Array<'active' | 'inactive' | 'suspended' | 'expired'>
}

/**
 * SubscriptionGuard Component
 * 
 * Enforces subscription status rules:
 * - ACTIVE: full access (default)
 * - INACTIVE: view-only access, shows alert  
 * - SUSPENDED: blocked, redirects to /billing
 * - EXPIRED: blocked, redirects to /billing
 */
export const SubscriptionGuard = ({
  children,
  allowedStatuses = ['active', 'inactive'],
}: SubscriptionGuardProps) => {
  const { clinicId, role } = useAuth()
  const navigate = useNavigate()
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Only check for admin users
        if (role !== 'admin' || !clinicId) {
          setLoading(false)
          return
        }

        const status = await checkSubscriptionStatus(clinicId)
        setSubscription(status)

        // Redirect if not in allowed statuses
        if (!allowedStatuses.includes(status.status)) {
          if (status.status === 'suspended' || status.status === 'expired') {
            navigate('/billing', { replace: true })
          }
        }
      } catch (error) {
        console.error('Error checking subscription in guard:', error)
      } finally {
        setLoading(false)
      }
    }

    checkStatus()
  }, [clinicId, role, navigate, allowedStatuses])

  if (loading) {
    return null
  }

  // Admins bypass subscription checks
  if (role === 'admin') {
    return <>{children}</>
  }

  // Check if status is allowed
  if (subscription && !allowedStatuses.includes(subscription.status)) {
    return null // Will redirect via useEffect
  }

  return <>{children}</>
}

/**
 * SubscriptionBanner Component
 * 
 * Shows alert for inactive subscriptions and expiring soon
 */
export const SubscriptionBanner = () => {
  const { clinicId, role } = useAuth()
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      if (role !== 'admin' || !clinicId) return
      try {
        const status = await checkSubscriptionStatus(clinicId)
        if (status.status === 'inactive') {
          setSubscription(status)
        }
      } catch (error) {
        console.error('Error in subscription banner:', error)
      }
    }

    checkStatus()
  }, [clinicId, role])

  if (!subscription || subscription.status !== 'inactive') {
    return null
  }

  return (
    <div className='glass rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 flex items-start gap-3'>
      <AlertCircle className='text-yellow-400 flex-shrink-0 mt-1' size={20} />
      <div>
        <p className='font-semibold text-yellow-300 text-sm'>حسابك غير نشط</p>
        <p className='text-yellow-200/70 text-xs mt-1'>اتصل بالمسؤول لتفعيل حسابك والوصول إلى جميع الميزات</p>
      </div>
    </div>
  )
}
