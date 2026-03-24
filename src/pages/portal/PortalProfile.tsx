import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { usePortalAuthSecure } from '@/hooks/usePortalAuthSecure'
import { usePortalSettingsWithShop } from '@/hooks/usePortalSettingsWithShop'
import { ArrowRight, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export function PortalProfile() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  // Auth & Settings
  const { customer, loading: authLoading, updateProfile } = usePortalAuthSecure(slug)
  const { settings, loading: settingsLoading } = usePortalSettingsWithShop(slug)

  // Form state
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' })
  const [updating, setUpdating] = useState(false)

  // Update browser title
  useEffect(() => {
    if (settings?.shop_name) {
      document.title = `${settings.shop_name} - بيانات الحساب`
    }
  }, [settings?.shop_name])

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
      toast.error('يرجى ملء الحقول المطلوبة')
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
        toast.success('تم تحديث البيانات بنجاح')
        setIsEditing(false)
      } else {
        toast.error('فشل تحديث البيانات')
      }
    } catch (err) {
      toast.error('خطأ في تحديث البيانات')
    } finally {
      setUpdating(false)
    }
  }

  if (authLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-gold-400/20 border-t-gold-400 animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" dir="rtl">
      <div className="max-w-2xl mx-auto p-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/shop/${slug}/dashboard`)}
          className="flex items-center gap-2 mb-8 text-white/70 hover:text-white transition"
        >
          <ArrowRight size={20} />
          العودة للرئيسة
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">بيانات الحساب</h1>
          <p className="text-white/60">مع {settings?.shop_name}</p>
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
                ✎ تحرير البيانات
              </button>
            </div>
          )}

          {isEditing ? (
            <>
              {/* Edit Form */}
              <div>
                <label className="block text-sm font-bold mb-3 text-white/70">الاسم الكامل *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                  placeholder="الاسم الكامل"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-3 text-white/70">البريد الإلكتروني *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                  placeholder="البريد الإلكتروني"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-3 text-white/70">رقم الهاتف *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition"
                  placeholder="رقم الهاتف"
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
                  {updating ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button
                  onClick={handleEditToggle}
                  disabled={updating}
                  className="flex-1 py-3 px-4 rounded-lg font-bold text-white bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Display Mode */}
              <div>
                <label className="block text-sm font-medium mb-3 text-white/60">الاسم الكامل</label>
                <p className="text-lg text-white font-semibold">{customer?.name || 'لم يتم إدخاله'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 text-white/60">البريد الإلكتروني</label>
                <p className="text-lg text-white font-semibold">{customer?.email || 'لم يتم إدخاله'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3 text-white/60">رقم الهاتف</label>
                <p className="text-lg text-white font-semibold" dir="ltr">
                  {customer?.phone || 'لم يتم إدخاله'}
                </p>
              </div>

              <div className="border-t border-white/10 pt-6 mt-6">
                <p className="text-white/70 text-sm mb-4">
                  معلومات حسابك محفوظة بشكل آمن. يمكنك تحرير البيانات أعلاه في أي وقت.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
