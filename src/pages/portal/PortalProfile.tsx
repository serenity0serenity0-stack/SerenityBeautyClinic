import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { usePortalAuthSecure } from '@/hooks/usePortalAuthSecure'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import { ArrowRight, Save } from 'lucide-react'
import { PortalBottomNav } from './PortalBottomNav'
import toast from 'react-hot-toast'

type Language = 'ar' | 'en'

const translations = {
  ar: {
    back: 'العودة للرئيسة',
    accountSettings: 'بيانات الحساب',
    with: 'مع',
    edit: '✎ تحرير البيانات',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف',
    save: 'حفظ التعديلات',
    saving: 'جاري الحفظ...',
    cancel: 'إلغاء',
    required: '(مطلوب)',
    loading: 'جاري التحميل...',
    notEntered: 'لم يتم إدخاله',
    fillRequired: 'يرجى ملء الحقول المطلوبة',
    updateSuccess: 'تم تحديث البيانات بنجاح',
    updateFailed: 'فشل تحديث البيانات',
    updateError: 'خطأ في تحديث البيانات',
    accountSecure: 'معلومات حسابك محفوظة بشكل آمن. يمكنك تحرير البيانات أعلاه في أي وقت.'
  },
  en: {
    back: 'Back to Dashboard',
    accountSettings: 'Account Settings',
    with: 'with',
    edit: '✎ Edit Profile',
    fullName: 'Full Name',
    email: 'Email',
    phone: 'Phone Number',
    save: 'Save Changes',
    saving: 'Saving...',
    cancel: 'Cancel',
    required: '(Required)',
    loading: 'Loading...',
    notEntered: 'Not entered',
    fillRequired: 'Please fill in required fields',
    updateSuccess: 'Profile updated successfully',
    updateFailed: 'Failed to update profile',
    updateError: 'Error updating profile',
    accountSecure: 'Your account information is securely stored. You can edit the information above at any time.'
  }
}

export function PortalProfile() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  // Language state (default to Arabic)
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem(`portal_lang_${slug}`)
    return (saved === 'en' ? 'en' : 'ar') as Language
  })

  // Set default language to Arabic if not already set
  useEffect(() => {
    if (!localStorage.getItem(`portal_lang_${slug}`)) {
      localStorage.setItem(`portal_lang_${slug}`, 'ar')
    }
  }, [slug])

  const t = translations[lang]
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang)
    localStorage.setItem(`portal_lang_${slug}`, newLang)
  }

  // Auth & Settings
  const { customer, loading: authLoading, updateProfile } = usePortalAuthSecure(slug)
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)

  // Form state
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' })
  const [updating, setUpdating] = useState(false)

  // Update browser title
  useEffect(() => {
    if (settings?.clinic_name) {
      document.title = `${settings.clinic_name} - ${t.accountSettings}`
    }
  }, [settings?.clinic_name, lang, t])

  useEffect(() => {
    if (!authLoading && !customer) {
      navigate(`/shop/${slug}/login`, { replace: true })
    }
  }, [customer, authLoading, slug, navigate])

  // Initialize form with customer data
  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || ''
      })
    }
  }, [customer])

  const handleEditToggle = () => {
    if (isEditing) {
      setFormData({
        name: customer?.name || '',
        email: customer?.email || '',
        phone: customer?.phone || ''
      })
    }
    setIsEditing(!isEditing)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      toast.error(t.fillRequired)
      return
    }

    setUpdating(true)
    try {
      const success = await updateProfile({
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone
      })
      if (success) {
        toast.success(t.updateSuccess)
        setIsEditing(false)
      } else {
        toast.error(t.updateFailed)
      }
    } catch (err) {
      toast.error(t.updateError)
    } finally {
      setUpdating(false)
    }
  }

  if (authLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">{t.loading}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24" dir={dir}>
      <div className="max-w-2xl mx-auto p-8">
        {/* Header with Back Button and Language Toggle */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(`/shop/${slug}/dashboard`)}
            className="flex items-center gap-2 text-white/70 hover:text-white transition"
          >
            <ArrowRight size={20} />
            {t.back}
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => handleLanguageChange(lang === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-bold transition"
          >
            <span>{lang === 'ar' ? 'EN' : 'ع'}</span>
          </button>
        </div>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t.accountSettings}</h1>
          <p className="text-white/60">{t.with} {settings?.clinic_name}</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-8 space-y-6">
          {/* Edit Toggle Button */}
          {!isEditing && (
            <div className="flex justify-end mb-4">
              <button
                onClick={handleEditToggle}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
              >
                {t.edit}
              </button>
            </div>
          )}

          {isEditing ? (
            <>
              {/* Edit Form */}
              <div>
                <label className="block text-sm font-bold mb-3 text-white/70">{t.fullName} {t.required}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                  placeholder={t.fullName}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-3 text-white/70">{t.email} {t.required}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                  placeholder={t.email}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-3 text-white/70">{t.phone} {t.required}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                  placeholder={t.phone}
                  dir="ltr"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  onClick={handleSave}
                  disabled={updating}
                  className="flex-1 py-3 px-4 rounded-lg font-bold text-black transition disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ 
                    backgroundColor: '#D4AF37',
                    opacity: updating ? 0.5 : 1
                  }}
                >
                  <Save size={20} />
                  {updating ? t.saving : t.save}
                </button>
                <button
                  onClick={handleEditToggle}
                  disabled={updating}
                  className="flex-1 py-3 px-4 rounded-lg font-bold text-white bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
                >
                  {t.cancel}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Display Mode */}
              <div>
                <label className="block text-sm font-medium mb-3 text-white/60">{t.fullName}</label>
                <p className="text-lg text-white font-semibold">{customer?.name || t.notEntered}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 text-white/60">{t.email}</label>
                <p className="text-lg text-white font-semibold">{customer?.email || t.notEntered}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 text-white/60">{t.phone}</label>
                <p className="text-lg text-white font-semibold" dir="ltr">
                  {customer?.phone || t.notEntered}
                </p>
              </div>

              <div className="border-t border-white/10 pt-6 mt-6">
                <p className="text-white/70 text-sm mb-4">
                  {t.accountSecure}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <PortalBottomNav primaryColor={settings?.primary_color || '#FFD700'} />
    </div>
  )
}
