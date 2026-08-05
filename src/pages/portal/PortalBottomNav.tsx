import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Home, Calendar, History, User } from 'lucide-react'

interface PortalBottomNavProps {
  primaryColor?: string
}

type Language = 'ar' | 'en'

const translations = {
  ar: {
    home: 'الرئيسية',
    bookings: 'المواعيد',
    history: 'السجل',
    profile: 'البيانات'
  },
  en: {
    home: 'Home',
    bookings: 'Bookings',
    history: 'History',
    profile: 'Profile'
  }
}

export function PortalBottomNav({ primaryColor = '#CDB4DB' }: PortalBottomNavProps) {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Language state - Listen for changes in localStorage
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(`portal_lang_${slug}`)
    return (saved === 'en' ? 'en' : 'ar') as Language
  })

  // Listen for language changes from toggle button or other pages
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(`portal_lang_${slug}`)
      const newLang = (saved === 'en' ? 'en' : 'ar') as Language
      setLang(newLang)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('languageChange', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('languageChange', handleStorageChange)
    }
  }, [slug])

  const t = translations[lang]
  const navItems = [
    { key: 'dashboard', label: t.home, path: 'dashboard', icon: Home },
    { key: 'bookings', label: t.bookings, path: 'bookings', icon: Calendar },
    { key: 'history', label: t.history, path: 'history', icon: History },
    { key: 'profile', label: t.profile, path: 'profile', icon: User }
  ]

  // Get current page from pathname
  const currentPage = location.pathname.split('/').pop() || 'dashboard'

  const handleNavigate = (path: string) => {
    navigate(`/shop/${slug}/${path}`)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '70px',
        background: 'rgba(10, 15, 30, 0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 100,
        paddingBottom: 'max(0px, env(safe-area-inset-bottom))'
      }}
    >
      {navItems.map((item) => {
        const isActive = currentPage === item.path
        const Icon = item.icon

        return (
          <button
            key={item.key}
            onClick={() => handleNavigate(item.path)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 12px',
              transition: 'all 0.3s ease',
              color: isActive ? primaryColor : 'rgba(255, 255, 255, 0.5)'
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255, 255, 255, 0.8)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255, 255, 255, 0.5)'
              }
            }}
          >
            <Icon size={24} />
            <span style={{ fontSize: '11px', fontWeight: isActive ? '600' : '500', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
