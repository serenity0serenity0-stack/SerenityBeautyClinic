import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { checkSubscriptionStatus } from '@/utils/subscriptionChecker'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { SubscriptionBanner } from '../subscription/SubscriptionGuard'

interface LayoutProps {
  children: React.ReactNode
  currentPath?: string
  onNavigate?: (path: string) => void
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPath, onNavigate }) => {
  const location = useLocation()
  const { clinicId, role } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'inactive' | 'suspended' | 'expired'>()

  // Use react-router's location if not provided as props
  const activePath = currentPath || location.pathname

  // Check subscription status for admin users
  useEffect(() => {
    const checkStatus = async () => {
      if (role !== 'admin' || !clinicId) return
      try {
        const status = await checkSubscriptionStatus(clinicId)
        setSubscriptionStatus(status.status)
      } catch (error) {
        console.error('Error checking subscription:', error)
      }
    }

    checkStatus()
  }, [clinicId, role])

  return (
    <div className="min-h-screen bg-gradient-to-br from-midnight via-[#0D1225] to-midnight dark:from-midnight dark:via-[#0D1225] dark:to-midnight">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      
      {/* Subscription Banner for Inactive Users */}
      {subscriptionStatus === 'inactive' && (
        <div className="px-4 sm:px-6 lg:px-8 mt-4">
          <SubscriptionBanner />
        </div>
      )}
      
      {/* Mobile Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPath={activePath}
        onNavigate={onNavigate}
        subscriptionStatus={subscriptionStatus}
      />

      {/* Main Content */}
      <main className="mt-16 px-4 py-6 sm:px-6 lg:px-8 min-h-screen">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
