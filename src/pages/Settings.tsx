import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../hooks/useLanguage'
import { useTheme } from '../hooks/useTheme'
import { GlassCard } from '../components/ui/GlassCard'
import { useSettings } from '../db/hooks/useSettings'
import { usePortalSettings } from '../db/hooks/usePortalSettings'
import { motion } from 'framer-motion'
import { exportToJSON, importFromJSON } from '../utils/exportCSV'
import toast from 'react-hot-toast'
import { Edit2, Save, X, Globe } from 'lucide-react'

export const Settings: React.FC = () => {
  const { t } = useTranslation()
  const { language, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { getSetting, updateSetting } = useSettings()
  const { portalSettings, updatePortalSettings, loading: portalLoading, fetchPortalSettings } = usePortalSettings()

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPortalEditing, setIsPortalEditing] = useState(false)
  const [isPortalSaving, setIsPortalSaving] = useState(false)
  
  // Local form state - separate from fetched data to prevent re-render clearing
  const [formData, setFormData] = useState({
    barbershopName: '',
    barbershopPhone: '',
  })

  // Portal form state - simplified without template and color customization
  const [portalFormData, setPortalFormData] = useState({
    is_active: false,
    portal_slug: '',
    welcome_message: '',
  })

  // Load settings once on mount - empty dependency array prevents re-runs
  useEffect(() => {
    const name = getSetting('barbershipName', 'My Barbershop')
    const phone = getSetting('barbershipPhone', '')
    setFormData({
      barbershopName: name,
      barbershopPhone: phone,
    })
  }, []) // Only run once on mount

  // Load portal settings when they're fetched
  useEffect(() => {
    if (portalSettings) {
      setPortalFormData({
        is_active: portalSettings.is_active,
        portal_slug: portalSettings.portal_slug,
        welcome_message: portalSettings.welcome_message || '',
      })
    }
  }, [portalSettings])

  const handleSaveSettings = async () => {
    if (!formData.barbershopName.trim()) {
      toast.error(t('settings.shop_name_required') || 'اسم المحل مطلوب')
      return
    }

    setIsSaving(true)
    try {
      // Save both name and phone to settings
      await updateSetting('barbershipName', formData.barbershopName)
      await updateSetting('barbershipPhone', formData.barbershopPhone)
      
      toast.success(t('settings.save_success') || 'تم حفظ البيانات بنجاح ✅')
      setIsEditing(false)
    } catch (err: any) {
      console.error('Save error:', err)
      toast.error(err.message || t('settings.save_error') || 'خطأ في حفظ البيانات')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Reload form data from settings
    const name = getSetting('barbershipName', 'My Barbershop')
    const phone = getSetting('barbershipPhone', '')
    setFormData({
      barbershopName: name,
      barbershopPhone: phone,
    })
    setIsEditing(false)
  }

  const handlePortalSaveSettings = async () => {
    if (!portalFormData.portal_slug.trim()) {
      toast.error('معرّف البوابة مطلوب')
      return
    }

    if (portalLoading) {
      toast.error('جاري تحميل إعدادات البوابة، يرجى الانتظار')
      return
    }

    setIsPortalSaving(true)
    try {
      // Always enable portal when saving settings with a slug
      await updatePortalSettings({
        is_active: true,
        portal_slug: portalFormData.portal_slug,
        welcome_message: portalFormData.welcome_message,
      })
      // Refetch to ensure state is fully updated before switching to view mode
      await fetchPortalSettings()
      setIsPortalEditing(false)
      toast.success('تم حفظ إعدادات البوابة وتفعيلها بنجاح ✓')
    } catch (err: any) {
      console.error('Error saving portal settings:', err)
      toast.error('حدث خطأ في حفظ البيانات')
    } finally {
      setIsPortalSaving(false)
    }
  }

  const handlePortalCancel = () => {
    if (portalSettings) {
      setPortalFormData({
        is_active: portalSettings.is_active,
        portal_slug: portalSettings.portal_slug,
        welcome_message: portalSettings.welcome_message || '',
      })
    }
    setIsPortalEditing(false)
  }

  const handleExportData = async () => {
    try {
      const data = {
        settings: getSetting('all'),
        exportDate: new Date().toISOString(),
      }
      exportToJSON(data, 'barbershop-backup')
      toast.success(t('notifications.data_exported'))
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0]
      if (!file) return

      await importFromJSON(file)
      toast.success(t('notifications.data_imported'))
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-3xl font-bold text-white">{t('settings.title')}</h1>
      </motion.div>

      {/* Barbershop Profile */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">{t('settings.barbershop_profile')}</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-400/30 rounded-lg hover:bg-blue-500/30 transition text-sm"
            >
              <Edit2 size={16} />
              تعديل
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">{t('settings.barbershop_name')}</label>
              <input
                type="text"
                value={formData.barbershopName}
                onChange={(e) => setFormData(prev => ({ ...prev, barbershopName: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-gold-400 focus:outline-none"
                placeholder="أدخل اسم المحل"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">رقم الهاتف</label>
              <input
                type="tel"
                value={formData.barbershopPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, barbershopPhone: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-gold-400 focus:outline-none"
                placeholder="أدخل رقم الهاتف (مثل: 01012345678)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg font-bold hover:bg-gold-400/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {isSaving ? t('common.saving') || 'جاري الحفظ...' : t('common.save') || 'حفظ'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-400/20 rounded-lg font-bold hover:bg-red-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={16} />
                {t('common.cancel') || 'إلغاء'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 bg-gray-800/30 p-4 rounded-lg">
            <div>
              <p className="text-xs text-gray-400">اسم المحل</p>
              <p className="text-lg font-semibold text-white">{formData.barbershopName || 'لم يتم التحديد'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">رقم الهاتف</p>
              <p className="text-lg font-semibold text-white">{formData.barbershopPhone || 'لم يتم التحديد'}</p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Customer Portal Settings */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe size={20} className="text-blue-400" />
            <h2 className="text-xl font-bold text-white">إعدادات بوابة العملاء</h2>
          </div>
          {!isPortalEditing && (
            <button
              onClick={() => setIsPortalEditing(true)}
              disabled={portalLoading}
              className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-400/30 rounded-lg hover:bg-blue-500/30 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit2 size={16} />
              {portalLoading ? 'جاري التحميل...' : 'تعديل'}
            </button>
          )}
        </div>

        {portalLoading && !isPortalEditing ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full border-4 border-blue-400/20 border-t-blue-400 animate-spin mx-auto mb-2" />
              <p className="text-gray-400">جاري تحميل إعدادات البوابة...</p>
            </div>
          </div>
        ) : isPortalEditing ? (
          <div className="space-y-4 md:space-y-5 p-3 md:p-4 bg-gray-800/20 rounded-lg">
            {/* Portal Active Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
              <span className="text-gray-300">تفعيل البوابة</span>
              <button
                type="button"
                onClick={() => setPortalFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  height: '24px',
                  width: '44px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0',
                  overflow: 'hidden',
                  backgroundColor: portalFormData.is_active ? '#22c55e' : '#4b5563',
                  transition: 'background-color 0.2s',
                  flexShrink: 0
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '3px',
                  left: portalFormData.is_active ? '23px' : '3px',
                  height: '18px',
                  width: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                }} />
              </button>
            </div>

            {/* Portal Slug */}
            <div>
              <label className="block text-sm md:text-base text-gray-300 mb-2 font-semibold">معرّف البوابة (slug)</label>
              <div className="space-y-2 md:flex md:gap-2">
                <span className="hidden md:block px-3 py-2 bg-gray-800/50 text-gray-400 rounded-lg text-sm whitespace-nowrap">{window.location.origin}/shop/</span>
                <input
                  type="text"
                  value={portalFormData.portal_slug}
                  onChange={(e) => setPortalFormData(prev => ({ ...prev, portal_slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  className="w-full px-3 py-2 md:flex-1 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-gold-400 focus:outline-none text-sm"
                  placeholder="my-barbershop"
                  dir="ltr"
                />
              </div>
              <div className="md:hidden mt-2 text-xs text-gray-500">{window.location.origin}/shop/{portalFormData.portal_slug || 'my-shop'}</div>
            </div>

            {/* Welcome Message */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">رسالة الترحيب</label>
              <textarea
                value={portalFormData.welcome_message}
                onChange={(e) => setPortalFormData(prev => ({ ...prev, welcome_message: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-gold-400 focus:outline-none resize-none"
                placeholder="أدخل رسالة ترحيب للعملاء"
                rows={3}
              />
            </div>

            {/* Save/Cancel Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-gray-600">
              <button
                onClick={handlePortalSaveSettings}
                disabled={isPortalSaving || portalLoading}
                className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg font-bold hover:bg-gold-400/30 transition disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-sm"
              >
                <Save size={18} />
                {isPortalSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button
                onClick={handlePortalCancel}
                disabled={isPortalSaving || portalLoading}
                className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-red-500/20 text-red-400 border border-red-400/20 rounded-lg font-bold hover:bg-red-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-sm"
              >
                <X size={18} />
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 bg-gray-800/30 p-4 rounded-lg">
            <div>
              <p className="text-xs text-gray-400">حالة البوابة</p>
              <p className="text-lg font-semibold text-white">
                {portalSettings?.is_active ? '✅ مفعّلة' : '❌ معطّلة'}
              </p>
            </div>
            {/* Portal Link - Professional UI */}
            <div>
              <p style={{ textAlign: 'right', marginBottom: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                رابط البوابة
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '10px 14px',
              }}>
                <a
                  href={`${window.location.origin}/shop/${portalSettings?.portal_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    color: '#D4AF37',
                    fontSize: '13px',
                    textDecoration: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    direction: 'ltr',
                    textAlign: 'left'
                  }}
                >
                  {window.location.origin}/shop/{portalSettings?.portal_slug}
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/shop/${portalSettings?.portal_slug}`)
                    toast.success('تم نسخ الرابط ✓')
                  }}
                  style={{
                    background: 'rgba(212,175,55,0.15)',
                    border: '1px solid rgba(212,175,55,0.3)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    color: '#D4AF37',
                    cursor: 'pointer',
                    fontSize: '12px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  📋 نسخ
                </button>
                <a
                  href={`${window.location.origin}/shop/${portalSettings?.portal_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'rgba(212,175,55,0.15)',
                    border: '1px solid rgba(212,175,55,0.3)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    color: '#D4AF37',
                    textDecoration: 'none',
                    fontSize: '12px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🔗 فتح
                </a>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400">حالة النظام</p>
              <p className="text-lg font-semibold text-white">✅ نشط</p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Display Preferences */}
      <GlassCard>
        <h2 className="text-xl font-bold text-white mb-4">{t('settings.display_preferences')}</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">{t('settings.language')}</span>
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              {language === 'ar' ? '🇪🇬 العربية' : '🇬🇧 English'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-300">{t('settings.theme')}</span>
            <button
              onClick={toggleTheme}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Data Management */}
      <GlassCard>
        <h2 className="text-xl font-bold text-white mb-4">{t('settings.data_management')}</h2>
        <div className="space-y-3">
          <button
            onClick={handleExportData}
            className="w-full px-4 py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg font-bold hover:bg-gold-400/30 transition"
          >
            📤 {t('settings.export_data')}
          </button>
          <label className="block">
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              className="hidden"
            />
            <div className="cursor-pointer px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg font-bold hover:bg-blue-500/30 transition text-center">
              📥 {t('settings.import_data')}
            </div>
          </label>
          <button className="w-full px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg font-bold hover:bg-red-500/30 transition">
            🗑️ {t('settings.reset_data')}
          </button>
        </div>
      </GlassCard>

      {/* About */}
      <GlassCard>
        <div className="text-center space-y-2">
          <p className="text-gray-400">💈 Barber Shop Management System</p>
          <p className="text-xs text-gray-500">v1.0.0 • Made with ❤️ for Egyptian barbershops</p>
          <p className="text-xs text-gray-500">🇪🇬 Powered by Supabase + React + Framer Motion</p>
        </div>
      </GlassCard>
    </div>
  )
}
