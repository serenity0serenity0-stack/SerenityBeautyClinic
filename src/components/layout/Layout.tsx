import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  children: React.ReactNode
  currentPath?: string
  onNavigate?: (path: string) => void
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPath, onNavigate }) => {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Use react-router's location if not provided as props
  const activePath = currentPath || location.pathname

  return (
    <div className="min-h-screen bg-gradient-to-br from-midnight via-[#0D1225] to-midnight dark:from-midnight dark:via-[#0D1225] dark:to-midnight">
      <Header onMenuClick={() => setSidebarOpen(true)} />
      
      {/* Mobile Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPath={activePath}
        onNavigate={onNavigate}
      />

      {/* Main Content */}
      <main className="mt-16 px-4 py-6 sm:px-6 lg:px-8 min-h-screen">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
