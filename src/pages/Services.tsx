import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Modal } from '../components/ui/Modal'
import { useServices } from '../db/hooks/useServices'
import { useServiceVariants } from '../db/hooks/useServiceVariants'
import { useAuth } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Plus, X, ChevronDown, ChevronUp, Edit2, Boxes } from 'lucide-react'
import toast from 'react-hot-toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

interface ServiceForm {
  nameAr: string
  nameEn: string
  price: number
  category: string
  serviceType: 'regular' | 'package'
  unitLabel: string
  packageQuantity: number
  bonusQuantity: number
  expiryValue: number
  expiryUnit: 'days' | 'weeks' | 'months'
  active: boolean
}

const emptyForm: ServiceForm = {
  nameAr: '',
  nameEn: '',
  price: 0,
  category: '',
  serviceType: 'regular',
  unitLabel: '',
  packageQuantity: 1,
  bonusQuantity: 0,
  expiryValue: 6,
  expiryUnit: 'months',
  active: true,
}

const categorySuggestions = ['hair', 'skincare', 'body', 'nails', 'makeup', 'packages', 'pulses', 'sessions', 'custom']

export const Services: React.FC = () => {
  const { t } = useTranslation()
  const { services, addService, updateService, deleteService } = useServices()
  const { addVariant, deleteVariant, updateVariant, getVariantsByServiceId } = useServiceVariants()
  const { clinicId } = useAuth()

  // Modals
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<any>(null)
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false)
  const [isEditVariantOpen, setIsEditVariantOpen] = useState(false)
  const [selectedServiceForVariant, setSelectedServiceForVariant] = useState<any>(null)
  const [editingVariant, setEditingVariant] = useState<any>(null)
  const [variantToDeleteId, setVariantToDeleteId] = useState<string | null>(null)
  const [serviceToDeleteId, setServiceToDeleteId] = useState<string | null>(null)
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false)

  // States
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null)
  const [serviceVariantsMap, setServiceVariantsMap] = useState<{ [key: string]: any[] }>({})
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyForm)
  const [variantForm, setVariantForm] = useState({
    name: '',
    price: 0,
    duration: 30,
    serviceType: 'package' as 'regular' | 'package',
    unitLabel: '',
    packageQuantity: 1,
    bonusQuantity: 0,
    expiryValue: 6,
    expiryUnit: 'months' as 'days' | 'weeks' | 'months',
  })
  const [editVariantForm, setEditVariantForm] = useState({
    name: '',
    price: 0,
    duration: 30,
    serviceType: 'package' as 'regular' | 'package',
    unitLabel: '',
    packageQuantity: 1,
    bonusQuantity: 0,
    expiryValue: 6,
    expiryUnit: 'months' as 'days' | 'weeks' | 'months',
  })

  // Load all service variants on mount and when services change
  useEffect(() => {
    const loadAllVariants = async () => {
      const variantsMap: { [key: string]: any[] } = {}

      for (const service of services) {
        if (!service.id) continue
        try {
          const variants = await getVariantsByServiceId(service.id)
          variantsMap[service.id] = variants || []
        } catch (err) {
          console.error(`Failed to load variants for service ${service.id}:`, err)
          variantsMap[service.id] = []
        }
      }

      setServiceVariantsMap(variantsMap)
    }

    if (services.length > 0) {
      loadAllVariants()
    }
  }, [services, getVariantsByServiceId])

  const openAddService = () => {
    setEditingService(null)
    setServiceForm(emptyForm)
    setIsServiceModalOpen(true)
  }

  const openEditService = (service: any) => {
    setEditingService(service)
    setServiceForm({
      nameAr: service.nameAr || '',
      nameEn: service.nameEn || '',
      price: service.price || 0,
      category: service.category || 'custom',
      serviceType: service.service_type || 'regular',
      unitLabel: service.unit_label || (service.service_type === 'package' ? 'جلسة' : ''),
      packageQuantity: service.package_quantity || 1,
      bonusQuantity: service.bonus_quantity || 0,
      expiryValue: service.expiry_value || 6,
      expiryUnit: service.expiry_unit || 'months',
      active: service.active,
    })
    setIsServiceModalOpen(true)
  }

  // Add or update a service (regular or package)
  const handleSaveService = async () => {
    const f = serviceForm
    if (!f.nameAr || !f.nameEn) {
      toast.error('الرجاء تعبئة اسم الخدمة بالعربية والإنجليزية')
      return
    }
    const hasVariants = editingService?.id
      ? (serviceVariantsMap[editingService.id]?.length || 0) > 0
      : false
    if (f.price <= 0 && !hasVariants) {
      toast.error('برجاء إدخال السعر')
      return
    }
    if (f.serviceType === 'package') {
      if (!f.unitLabel || f.packageQuantity <= 0) {
        toast.error('برجاء إدخال وحدة الباقة وعدد الوحدات (مثال: 1000 نبضة)')
        return
      }
    }

    const payload = {
      nameAr: f.nameAr,
      nameEn: f.nameEn,
      price: f.price,
      duration: 30,
      category: f.category,
      active: f.active,
      service_type: f.serviceType,
      unit_label: f.serviceType === 'package' ? f.unitLabel : null,
      package_quantity: f.serviceType === 'package' ? f.packageQuantity : null,
      bonus_quantity: f.serviceType === 'package' ? f.bonusQuantity || 0 : 0,
      expiry_value: f.serviceType === 'package' && f.expiryValue > 0 ? f.expiryValue : null,
      expiry_unit: f.serviceType === 'package' && f.expiryValue > 0 ? f.expiryUnit : null,
    }

    try {
      if (editingService?.id) {
        await updateService(editingService.id, payload)
        toast.success('✅ تم تحديث الخدمة بنجاح', { duration: 2500 })
      } else {
        await addService(payload)
        toast.success(
          f.serviceType === 'package'
            ? `✅ تم إنشاء الباقة: ${f.packageQuantity} ${f.unitLabel}${f.bonusQuantity > 0 ? ` + ${f.bonusQuantity} بونص` : ''}`
            : '✅ تم إنشاء الخدمة بنجاح',
          { duration: 3000 }
        )
      }
      setIsServiceModalOpen(false)
    } catch (err) {
      toast.error(t('errors.database_error'))
      console.error('Error saving service:', err)
    }
  }

  // Add variant/detail
  const handleAddVariant = async () => {
    if (!variantForm.name || variantForm.price <= 0) {
      toast.error('الرجاء تعبئة اسم التفصيل والسعر')
      return
    }
    if (variantForm.serviceType === 'package' && (!variantForm.unitLabel || variantForm.packageQuantity <= 0)) {
      toast.error('برجاء إدخال وحدة الباقة وعدد الوحدات (مثال: 1000 نبضة)')
      return
    }

    if (!selectedServiceForVariant?.id) {
      toast.error('يجب اختيار خدمة أولاً')
      return
    }

    try {
      await addVariant({
        clinic_id: clinicId as string,
        service_id: selectedServiceForVariant.id,
        name: variantForm.name,
        price: variantForm.price,
        duration: variantForm.duration,
        isActive: true,
        service_type: variantForm.serviceType,
        unit_label: variantForm.serviceType === 'package' ? variantForm.unitLabel : null,
        package_quantity: variantForm.serviceType === 'package' ? variantForm.packageQuantity : null,
        bonus_quantity: variantForm.serviceType === 'package' ? variantForm.bonusQuantity || 0 : 0,
        expiry_value: variantForm.serviceType === 'package' && variantForm.expiryValue > 0 ? variantForm.expiryValue : null,
        expiry_unit: variantForm.serviceType === 'package' && variantForm.expiryValue > 0 ? variantForm.expiryUnit : null,
      })

      setVariantForm({ name: '', price: 0, duration: 30, serviceType: 'package', unitLabel: '', packageQuantity: 1, bonusQuantity: 0, expiryValue: 6, expiryUnit: 'months' })
      toast.success('✨ تم إضافة التفاصيل بنجاح!', { duration: 2500, icon: '💚' })

      try {
        const freshVariants = await getVariantsByServiceId(selectedServiceForVariant.id)
        setServiceVariantsMap((prev) => ({
          ...prev,
          [selectedServiceForVariant.id]: freshVariants || [],
        }))
      } catch { /* ignore reload error */ }

      setIsAddVariantOpen(false)
      setSelectedServiceForVariant(null)
    } catch (err) {
      toast.error(t('errors.database_error'))
      console.error('Error adding variant:', err)
    }
  }

  // Delete variant
  const handleDeleteVariant = (variantId: string) => setVariantToDeleteId(variantId)

  const handleConfirmDeleteVariant = async () => {
    if (!variantToDeleteId) return
    try {
      await deleteVariant(variantToDeleteId)
      toast.success('✨ تم حذف التفصيل بنجاح', { duration: 2000, icon: '🗑️' })

      const updated = { ...serviceVariantsMap }
      Object.keys(updated).forEach((serviceId) => {
        updated[serviceId] = updated[serviceId].filter((v) => v.id !== variantToDeleteId)
      })
      setServiceVariantsMap(updated)
    } catch (err) {
      toast.error(t('errors.database_error'))
    } finally {
      setVariantToDeleteId(null)
    }
  }

  // Edit variant
  const handleEditVariant = async () => {
    if (!editVariantForm.name || editVariantForm.price <= 0) {
      toast.error('الرجاء تعبئة اسم التفصيل والسعر')
      return
    }
    if (editVariantForm.serviceType === 'package' && (!editVariantForm.unitLabel || editVariantForm.packageQuantity <= 0)) {
      toast.error('برجاء إدخال وحدة الباقة وعدد الوحدات (مثال: 1000 نبضة)')
      return
    }

    if (!editingVariant?.id) {
      toast.error('خطأ في البيانات')
      return
    }

    try {
      await updateVariant(editingVariant.id, {
        name: editVariantForm.name,
        price: editVariantForm.price,
        duration: editVariantForm.duration,
        isActive: editingVariant.isActive,
        service_type: editVariantForm.serviceType,
        unit_label: editVariantForm.serviceType === 'package' ? editVariantForm.unitLabel : null,
        package_quantity: editVariantForm.serviceType === 'package' ? editVariantForm.packageQuantity : null,
        bonus_quantity: editVariantForm.serviceType === 'package' ? editVariantForm.bonusQuantity || 0 : 0,
        expiry_value: editVariantForm.serviceType === 'package' && editVariantForm.expiryValue > 0 ? editVariantForm.expiryValue : null,
        expiry_unit: editVariantForm.serviceType === 'package' && editVariantForm.expiryValue > 0 ? editVariantForm.expiryUnit : null,
      })

      toast.success('✅ تم تحديث التفصيل بنجاح!', { duration: 2500, icon: '📝' })
      setIsEditVariantOpen(false)
      setEditingVariant(null)
      setEditVariantForm({ name: '', price: 0, duration: 30, serviceType: 'package', unitLabel: '', packageQuantity: 1, bonusQuantity: 0, expiryValue: 6, expiryUnit: 'months' })

      if (selectedServiceForVariant?.id) {
        const variants = await getVariantsByServiceId(selectedServiceForVariant.id)
        setServiceVariantsMap((prev) => ({
          ...prev,
          [selectedServiceForVariant.id]: variants || [],
        }))
      }
    } catch (err) {
      toast.error(t('errors.database_error'))
      console.error('Error updating variant:', err)
    }
  }

  // Delete service
  const handleDeleteService = (id: string) => setServiceToDeleteId(id)

  const handleConfirmDeleteService = async () => {
    if (!serviceToDeleteId) return
    try {
      await deleteService(serviceToDeleteId)
      toast.success('✅ تم حذف الخدمة بنجاح', { duration: 2000, icon: '🗑️' })
    } catch (err) {
      toast.error(t('errors.database_error'))
    } finally {
      setServiceToDeleteId(null)
    }
  }

  // Delete all services
  const handleDeleteAllServices = async () => {
    if (services.length === 0) {
      toast.error('لا توجد خدمات للحذف')
      return
    }
    setIsDeleteAllOpen(true)
  }

  const handleConfirmDeleteAllServices = async () => {
    try {
      let deletedCount = 0
      const errors: string[] = []

      for (const service of services) {
        if (service.id) {
          try {
            await deleteService(service.id)
            deletedCount++
          } catch (err) {
            errors.push(`فشل حذف: ${service.nameAr}`)
            console.error('Error deleting service:', err)
          }
        }
      }

      if (errors.length === 0) {
        toast.success(`✅ تم حذف ${deletedCount} خدمة بنجاح`, { duration: 3000, icon: '🎉' })
      } else {
        toast.error(`تم حذف ${deletedCount} خدمة. فشل: ${errors.length}`)
      }
    } catch (err) {
      toast.error(t('errors.database_error'))
    } finally {
      setIsDeleteAllOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-white">الخدمات والأسعار</h1>
          <p className="text-sm text-gray-400 mt-1">
            الخدمات العادية تُباع مرة واحدة • الباقات تُضاف لرصيد العميل (جلسات / نبضات) مع بونص وصلاحية
          </p>
        </div>
        <div className="flex items-center gap-3">
          {services.length > 0 && (
            <motion.button
              onClick={handleDeleteAllServices}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-400/20 rounded-lg hover:bg-red-500/30 transition"
              title="حذف جميع الخدمات"
            >
              <Trash2 size={20} />
              حذف الكل
            </motion.button>
          )}
          <motion.button
            onClick={openAddService}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-700/20 text-pink-400 border border-pink-500/20 rounded-lg hover:bg-gradient-to-r from-pink-600 to-pink-700/30 transition"
          >
            <Plus size={20} />
            خدمة جديدة
          </motion.button>
        </div>
      </motion.div>

      {/* Services List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence>
          {services && services.length > 0 ? (
            services.map((service, idx) => {
              const serviceId = service.id || String(idx)
              const serviceVariants = serviceVariantsMap[serviceId] || []
              const isExpanded = expandedServiceId === serviceId
              const isPackage = service.service_type === 'package'

              return (
                <motion.div
                  key={serviceId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <GlassCard className={isPackage ? 'hover:border-purple-500/50 transition' : 'hover:border-pink-500/50 transition'}>
                    <div className="space-y-4">
                      {/* Service Header - CLICKABLE DROPDOWN */}
                      <button
                        onClick={() => setExpandedServiceId(isExpanded ? null : serviceId)}
                        className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-lg transition group"
                      >
                        <div className="flex-1 text-right">
                          <div className="flex items-center gap-2">
                            {isPackage && <Boxes size={18} className="text-purple-400" />}
                            <h3 className="text-white font-bold text-lg group-hover:text-pink-400 transition">
                              {service.nameAr}
                            </h3>
                            <p className="text-xs text-gray-400">{service.nameEn}</p>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {isPackage && service.package_quantity ? (
                              <span className="text-[11px] font-bold bg-purple-500/20 border border-purple-500/40 text-purple-300 rounded-full px-2 py-0.5">
                                {service.package_quantity} {service.unit_label || ''}
                                {(service.bonus_quantity || 0) > 0
                                  ? ` + ${service.bonus_quantity} ${service.unit_label || ''} بونص`
                                  : ''}
                              </span>
                            ) : (
                              <span className="text-[11px] bg-white/5 border border-white/10 text-gray-300 rounded-full px-2 py-0.5">
                                خدمة عادية
                              </span>
                            )}
                            {isPackage && (service.expiry_value ?? 0) > 0 ? (
                              <span className="text-[11px] bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full px-2 py-0.5">
                                ⏰ صالحة {service.expiry_value}{' '}
                                {service.expiry_unit === 'days' ? 'يوم' : service.expiry_unit === 'weeks' ? 'أسبوع' : 'شهر'}
                              </span>
                            ) : null}
                            <span className="text-[11px] text-gray-400">🏷️ {service.category}</span>
                            {serviceVariants.length > 0 && (
                              <span className="text-[11px] text-pink-400">📦 {serviceVariants.length} تفصيل</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ms-3 flex-shrink-0">
                          {serviceVariants.length === 0 && (
                            <p className="text-pink-400 font-bold text-lg">{service.price} ج.م</p>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditService(service)
                            }}
                            className="p-2 hover:bg-blue-500/10 rounded transition"
                            title="تعديل"
                          >
                            <Edit2 size={18} className="text-blue-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteService(service.id!)
                            }}
                            className="p-2 hover:bg-red-500/10 rounded transition"
                            title="حذف الخدمة"
                          >
                            <Trash2 size={18} className="text-red-400" />
                          </button>
                          {isExpanded ? (
                            <ChevronUp size={20} className="text-pink-400" />
                          ) : (
                            <ChevronDown size={20} className="text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 border-t border-white/10 pt-4"
                          >
                            {/* Add Variant Button */}
                            <motion.button
                              onClick={() => {
                                setSelectedServiceForVariant(service)
                                setIsAddVariantOpen(true)
                              }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-500/10 text-green-400 border border-green-400/30 rounded hover:bg-green-500/20 transition text-sm"
                            >
                              <Plus size={16} />
                              أضف تفصيل جديد (خيار اختياري بالكاشير)
                            </motion.button>

                            {/* Variants List */}
                            {serviceVariants.length > 0 && (
                              <div className="space-y-2">
                                {serviceVariants.map((variant: any) => (
                                  <motion.div
                                    key={variant.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className={`flex items-center justify-between p-3 bg-gradient-to-r from-white/5 to-white/0 rounded-lg border ${
                                      !variant.isActive
                                        ? 'border-red-400/30 opacity-60'
                                        : 'border-pink-500/20 hover:border-pink-500/40'
                                    } transition`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={`text-sm font-medium truncate ${
                                          !variant.isActive ? 'text-gray-400 line-through' : 'text-white'
                                        }`}
                                      >
                                        {variant.name}
                                      </p>
                                      <p className="text-xs text-gray-400">⏱️ {variant.duration || 30} دقيقة</p>
                                      {(variant.service_type === 'package' || (variant.service_type == null && isPackage)) && variant.package_quantity ? (
                                        <p className="text-xs text-purple-300 mt-0.5">
                                          {variant.package_quantity} {variant.unit_label || ''}
                                          {(variant.bonus_quantity || 0) > 0 ? ` + ${variant.bonus_quantity} بونص` : ''}
                                          {(variant.expiry_value ?? 0) > 0
                                            ? ` — صالحة ${variant.expiry_value} ${
                                                variant.expiry_unit === 'days' ? 'يوم' : variant.expiry_unit === 'weeks' ? 'أسبوع' : 'شهر'
                                              }`
                                            : ''}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-3 ms-3 flex-shrink-0">
                                      <p className="text-pink-400 font-bold text-lg">{variant.price} ج.م</p>
                                      <button
                                        onClick={() => {
                                          setEditingVariant(variant)
                                          setEditVariantForm({
                                            name: variant.name,
                                            price: variant.price,
                                            duration: variant.duration || 30,
                                            serviceType: variant.service_type || 'package',
                                            unitLabel: variant.unit_label || '',
                                            packageQuantity: variant.package_quantity || 1,
                                            bonusQuantity: variant.bonus_quantity || 0,
                                            expiryValue: variant.expiry_value || 6,
                                            expiryUnit: variant.expiry_unit || 'months',
                                          })
                                          setSelectedServiceForVariant({ id: serviceId })
                                          setIsEditVariantOpen(true)
                                        }}
                                        className="p-1 hover:bg-blue-500/20 rounded transition"
                                        title="تعديل"
                                      >
                                        <Edit2 size={16} className="text-blue-400" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteVariant(variant.id)}
                                        className="p-1 hover:bg-red-500/10 rounded transition"
                                        title="حذف"
                                      >
                                        <X size={16} className="text-red-400" />
                                      </button>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </GlassCard>
                </motion.div>
              )
            })
          ) : (
            <GlassCard className="col-span-full">
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">لا توجد خدمات حالياً</p>
                <motion.button
                  onClick={openAddService}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-700/20 text-pink-400 border border-pink-500/20 rounded-lg hover:bg-gradient-to-r from-pink-600 to-pink-700/30 transition mx-auto"
                >
                  <Plus size={20} />
                  أضف أول خدمة
                </motion.button>
              </div>
            </GlassCard>
          )}
        </AnimatePresence>
      </div>

      {/* Add / Edit Service Modal */}
      <Modal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        title={editingService ? `تعديل: ${editingService.nameAr || ''}` : 'أضف خدمة جديدة'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">اسم الخدمة بالعربية *</label>
              <input
                type="text"
                placeholder="مثال: نبضات، جلسات ميزوثيرابي، تقشير"
                value={serviceForm.nameAr}
                onChange={(e) => setServiceForm({ ...serviceForm, nameAr: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Service Name in English *</label>
              <input
                type="text"
                placeholder="Example: Pulses, Mesotherapy Sessions"
                value={serviceForm.nameEn}
                onChange={(e) => setServiceForm({ ...serviceForm, nameEn: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                السعر (ج.م)
                {editingService?.id && (serviceVariantsMap[editingService.id]?.length || 0) > 0
                  ? ' (اختياري — التفاصيل تحدد الأسعار)'
                  : ' *'}
              </label>
              <input
                type="number"
                placeholder="مثال: 400"
                value={serviceForm.price}
                onChange={(e) => setServiceForm({ ...serviceForm, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">التصنيف</label>
              <input
                type="text"
                list="category-suggestions"
                placeholder="مثال: pulses, sessions, skincare"
                value={serviceForm.category}
                onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
              <datalist id="category-suggestions">
                {categorySuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Service type toggle */}
          <div>
            <label className="block text-sm text-gray-300 mb-2 mt-2">نوع الخدمة</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setServiceForm({ ...serviceForm, serviceType: 'regular' })}
                className={`px-4 py-3 rounded-lg border text-sm font-bold transition ${
                  serviceForm.serviceType === 'regular'
                    ? 'bg-pink-600/30 border-pink-500 text-pink-300'
                    : 'bg-white/5 border-white/15 text-gray-300 hover:bg-white/10'
                }`}
              >
                خدمة عادية (تُباع مرة واحدة)
              </button>
              <button
                type="button"
                onClick={() => setServiceForm({ ...serviceForm, serviceType: 'package' })}
                className={`px-4 py-3 rounded-lg border text-sm font-bold transition ${
                  serviceForm.serviceType === 'package'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                    : 'bg-white/5 border-white/15 text-gray-300 hover:bg-white/10'
                }`}
              >
                باقة / اشتراك (يُضاف لرصيد العميل)
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              الباقات تُخزن في رصيد العميل وتُستهلك لاحقاً (جلسات / نبضات). مثال: 1000 نبضة + 150 بونص = 1150 في الرصيد.
            </p>
          </div>

          {/* Package config */}
          {serviceForm.serviceType === 'package' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">اسم الوحدة *</label>
                  <input
                    type="text"
                    placeholder="جلسة | نبضة"
                    value={serviceForm.unitLabel}
                    onChange={(e) => setServiceForm({ ...serviceForm, unitLabel: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">عدد الوحدات (المدفوعة) *</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="مثال: 1000"
                    value={serviceForm.packageQuantity || ''}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, packageQuantity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">البونص (إضافي)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="مثال: 150"
                    value={serviceForm.bonusQuantity || ''}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, bonusQuantity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">الصلاحية (كل)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="مثال: 3"
                    value={serviceForm.expiryValue || ''}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, expiryValue: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">وحدة الصلاحية</label>
                  <select
                    value={serviceForm.expiryUnit}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, expiryUnit: e.target.value as any })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="days">يوم</option>
                    <option value="weeks">أسبوع</option>
                    <option value="months">شهر</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-purple-300">
                ملخص: يشتري العميل {serviceForm.packageQuantity || 0} {serviceForm.unitLabel || '...'} بسعر{' '}
                {serviceForm.price} ج.م
                {serviceForm.bonusQuantity > 0
                  ? ` + ${serviceForm.bonusQuantity} ${serviceForm.unitLabel || '...'} بونص`
                  : ''}
                {serviceForm.expiryValue > 0
                  ? ` - صالحة ${serviceForm.expiryValue} ${
                      serviceForm.expiryUnit === 'days' ? 'يوم' : serviceForm.expiryUnit === 'weeks' ? 'أسبوع' : 'شهر'
                    }`
                  : ' (بدون تاريخ صلاحية)'}
              </p>
            </motion.div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={serviceForm.active}
              onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })}
              className="w-4 h-4 accent-pink-500"
              id="service-active"
            />
            <label htmlFor="service-active" className="text-sm text-gray-300">
              الخدمة مفعلة (ظاهرة في الكاشير)
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <motion.button
              onClick={handleSaveService}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-lg font-semibold hover:from-pink-700 hover:to-pink-800 transition shadow-lg"
            >
              {editingService ? '💾 حفظ التعديلات' : '✅ إضافة الخدمة'}
            </motion.button>
            <motion.button
              onClick={() => setIsServiceModalOpen(false)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition"
            >
              إلغاء
            </motion.button>
          </div>
        </div>
      </Modal>

      {/* Add Variant Modal */}
      <Modal
        isOpen={isAddVariantOpen}
        onClose={() => {
          setIsAddVariantOpen(false)
          setSelectedServiceForVariant(null)
          setVariantForm({ name: '', price: 0, duration: 30, serviceType: 'package', unitLabel: '', packageQuantity: 1, bonusQuantity: 0, expiryValue: 6, expiryUnit: 'months' })
        }}
        title={`أضف تفصيل لـ: ${selectedServiceForVariant?.nameAr || ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">اسم التفصيل/الحزمة *</label>
            <input
              type="text"
              placeholder="مثال: 3 جلسات + كريم، حزمة bronze، حزمة vip"
              value={variantForm.name}
              onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              autoFocus
            />
          </div>

          {/* Service type toggle */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">نوع التفصيل</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVariantForm({ ...variantForm, serviceType: 'regular' })}
                className={`px-4 py-2 rounded-lg border text-sm font-bold transition ${
                  variantForm.serviceType === 'regular'
                    ? 'bg-pink-600/30 border-pink-500 text-pink-300'
                    : 'bg-white/5 border-white/15 text-gray-300 hover:bg-white/10'
                }`}
              >
                تفصيل عادي (سعر واحد)
              </button>
              <button
                type="button"
                onClick={() => setVariantForm({ ...variantForm, serviceType: 'package' })}
                className={`px-4 py-2 rounded-lg border text-sm font-bold transition ${
                  variantForm.serviceType === 'package'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                    : 'bg-white/5 border-white/15 text-gray-300 hover:bg-white/10'
                }`}
              >
                باقة (رصيد العميل)
              </button>
            </div>
          </div>

          {/* Package config */}
          {variantForm.serviceType === 'package' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">اسم الوحدة *</label>
                  <input
                    type="text"
                    placeholder="جلسة | نبضة"
                    value={variantForm.unitLabel}
                    onChange={(e) => setVariantForm({ ...variantForm, unitLabel: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">عدد الوحدات (المدفوعة) *</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="مثال: 1000"
                    value={variantForm.packageQuantity || ''}
                    onChange={(e) =>
                      setVariantForm({ ...variantForm, packageQuantity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">البونص (إضافي)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="مثال: 150"
                    value={variantForm.bonusQuantity || ''}
                    onChange={(e) =>
                      setVariantForm({ ...variantForm, bonusQuantity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">الصلاحية (كل)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="مثال: 3"
                    value={variantForm.expiryValue || ''}
                    onChange={(e) =>
                      setVariantForm({ ...variantForm, expiryValue: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">وحدة الصلاحية</label>
                  <select
                    value={variantForm.expiryUnit}
                    onChange={(e) =>
                      setVariantForm({ ...variantForm, expiryUnit: e.target.value as any })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="days">يوم</option>
                    <option value="weeks">أسبوع</option>
                    <option value="months">شهر</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">السعر (ج.م) *</label>
              <input
                type="number"
                placeholder="مثال: 150"
                value={variantForm.price}
                onChange={(e) => setVariantForm({ ...variantForm, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">المدة (دقائق)</label>
              <input
                type="number"
                placeholder="30"
                value={variantForm.duration}
                onChange={(e) => setVariantForm({ ...variantForm, duration: parseInt(e.target.value) || 30 })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <motion.button
              onClick={handleAddVariant}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition"
            >
              إضافة
            </motion.button>
            <motion.button
              onClick={() => {
                setIsAddVariantOpen(false)
                setSelectedServiceForVariant(null)
                setVariantForm({ name: '', price: 0, duration: 30, serviceType: 'package', unitLabel: '', packageQuantity: 1, bonusQuantity: 0, expiryValue: 6, expiryUnit: 'months' })
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition"
            >
              إلغاء
            </motion.button>
          </div>
        </div>
      </Modal>

      {/* Edit Variant Modal */}
      <Modal
        isOpen={isEditVariantOpen}
        onClose={() => {
          setIsEditVariantOpen(false)
          setEditingVariant(null)
          setEditVariantForm({ name: '', price: 0, duration: 30, serviceType: 'package', unitLabel: '', packageQuantity: 1, bonusQuantity: 0, expiryValue: 6, expiryUnit: 'months' })
        }}
        title={`تعديل: ${editingVariant?.name || ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">اسم التفصيل/الحزمة *</label>
            <input
              type="text"
              placeholder="مثال: 3 جلسات + كريم، حزمة bronze، حزمة vip"
              value={editVariantForm.name}
              onChange={(e) => setEditVariantForm({ ...editVariantForm, name: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              autoFocus
            />
          </div>

          {/* Service type toggle */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">نوع التفصيل</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditVariantForm({ ...editVariantForm, serviceType: 'regular' })}
                className={`px-4 py-2 rounded-lg border text-sm font-bold transition ${
                  editVariantForm.serviceType === 'regular'
                    ? 'bg-pink-600/30 border-pink-500 text-pink-300'
                    : 'bg-white/5 border-white/15 text-gray-300 hover:bg-white/10'
                }`}
              >
                تفصيل عادي (سعر واحد)
              </button>
              <button
                type="button"
                onClick={() => setEditVariantForm({ ...editVariantForm, serviceType: 'package' })}
                className={`px-4 py-2 rounded-lg border text-sm font-bold transition ${
                  editVariantForm.serviceType === 'package'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                    : 'bg-white/5 border-white/15 text-gray-300 hover:bg-white/10'
                }`}
              >
                باقة (رصيد العميل)
              </button>
            </div>
          </div>

          {/* Package config */}
          {editVariantForm.serviceType === 'package' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">اسم الوحدة *</label>
                  <input
                    type="text"
                    placeholder="جلسة | نبضة"
                    value={editVariantForm.unitLabel}
                    onChange={(e) => setEditVariantForm({ ...editVariantForm, unitLabel: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">عدد الوحدات (المدفوعة) *</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="مثال: 1000"
                    value={editVariantForm.packageQuantity || ''}
                    onChange={(e) =>
                      setEditVariantForm({ ...editVariantForm, packageQuantity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">البونص (إضافي)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="مثال: 150"
                    value={editVariantForm.bonusQuantity || ''}
                    onChange={(e) =>
                      setEditVariantForm({ ...editVariantForm, bonusQuantity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">الصلاحية (كل)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="مثال: 3"
                    value={editVariantForm.expiryValue || ''}
                    onChange={(e) =>
                      setEditVariantForm({ ...editVariantForm, expiryValue: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">وحدة الصلاحية</label>
                  <select
                    value={editVariantForm.expiryUnit}
                    onChange={(e) =>
                      setEditVariantForm({ ...editVariantForm, expiryUnit: e.target.value as any })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="days">يوم</option>
                    <option value="weeks">أسبوع</option>
                    <option value="months">شهر</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">السعر (ج.م) *</label>
              <input
                type="number"
                placeholder="مثال: 150"
                value={editVariantForm.price}
                onChange={(e) => setEditVariantForm({ ...editVariantForm, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">المدة (دقائق)</label>
              <input
                type="number"
                placeholder="30"
                value={editVariantForm.duration}
                onChange={(e) => setEditVariantForm({ ...editVariantForm, duration: parseInt(e.target.value) || 30 })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <motion.button
              onClick={handleEditVariant}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition"
            >
              حفظ التعديلات
            </motion.button>
            <motion.button
              onClick={() => {
                setIsEditVariantOpen(false)
                setEditingVariant(null)
                setEditVariantForm({ name: '', price: 0, duration: 30, serviceType: 'package', unitLabel: '', packageQuantity: 1, bonusQuantity: 0, expiryValue: 6, expiryUnit: 'months' })
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition"
            >
              إلغاء
            </motion.button>
          </div>
        </div>
      </Modal>

      {/* Delete Variant Confirmation */}
      <ConfirmDialog
        isOpen={!!variantToDeleteId}
        onClose={() => setVariantToDeleteId(null)}
        onConfirm={handleConfirmDeleteVariant}
        title="حذف التفصيل"
        description="هل تريد حذف هذا التفصيل؟ سيتم حذفه من الخدمة ولا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        variant="danger"
      />

      {/* Delete Service Confirmation */}
      <ConfirmDialog
        isOpen={!!serviceToDeleteId}
        onClose={() => setServiceToDeleteId(null)}
        onConfirm={handleConfirmDeleteService}
        title="حذف الخدمة"
        description="هل تريد حذف هذه الخدمة وجميع تفاصيلها؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        variant="danger"
      />

      {/* Delete All Services Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteAllOpen}
        onClose={() => setIsDeleteAllOpen(false)}
        onConfirm={handleConfirmDeleteAllServices}
        title="حذف جميع الخدمات"
        description={`هل تريد بالفعل حذف جميع الخدمات (${services.length} خدمة)؟ هذا الإجراء لا يمكن التراجع عنه!`}
        confirmText="حذف"
        cancelText="إلغاء"
        variant="danger"
      />
    </div>
  )
}