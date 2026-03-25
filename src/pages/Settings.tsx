import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../hooks/useLanguage'
import { useTheme } from '../hooks/useTheme'
import { GlassCard } from '../components/ui/GlassCard'
import { useSettings } from '../db/hooks/useSettings'
import { motion } from 'framer-motion'
import { exportToJSON, importFromJSON } from '../utils/exportCSV'
import toast from 'react-hot-toast'
import { Edit2, Save, X } from 'lucide-react'

export const Settings: React.FC = () => {
  const { t } = useTranslation()
  const { language, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const { getSetting, updateSetting } = useSettings()

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Local form state - separate from fetched data to prevent re-render clearing
  const [formData, setFormData] = useState({
    barbershopName: '',
    barbershopPhone: '',
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
          <p className="text-gray-400">© YousefTech 2026</p>
          <p className="text-xs text-gray-500">نظام تطوير YousefTech • 01000139417</p>
        </div>
      </GlassCard>
    </div>
  )
}
