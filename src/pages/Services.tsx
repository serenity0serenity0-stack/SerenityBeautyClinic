import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Modal } from '../components/ui/Modal'
import { useServices } from '../db/hooks/useServices'
import { useServiceVariants } from '../db/hooks/useServiceVariants'
import { useAuth } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Plus, X, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

export const Services: React.FC = () => {
  const { t } = useTranslation()
  const { services, addService, deleteService } = useServices()
  const { addVariant, deleteVariant, updateVariant, getVariantsByServiceId } = useServiceVariants()
  const { clinicId } = useAuth()
  
  // Modals
  const [isAddBaseServiceOpen, setIsAddBaseServiceOpen] = useState(false)
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false)
  const [isEditVariantOpen, setIsEditVariantOpen] = useState(false)
  const [selectedServiceForVariant, setSelectedServiceForVariant] = useState<any>(null)
  const [editingVariant, setEditingVariant] = useState<any>(null)
  
  // States
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null)
  const [serviceVariantsMap, setServiceVariantsMap] = useState<{[key: string]: any[]}>({})
  const [baseServiceForm, setBaseServiceForm] = useState({
    nameAr: '',
    nameEn: '',
  })
  const [variantForm, setVariantForm] = useState({
    name: '',
    price: 0,
    duration: 30,
  })
  const [editVariantForm, setEditVariantForm] = useState({
    name: '',
    price: 0,
    duration: 30,
  })

  // Load all service variants on mount and when services change
  useEffect(() => {
    const loadAllVariants = async () => {
      const variantsMap: {[key: string]: any[]} = {}
      
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

  // Add base service
  const handleAddBaseService = async () => {
    if (!baseServiceForm.nameAr || !baseServiceForm.nameEn) {
      toast.error('الرجاء تعبئة اسم الخدمة بالعربية والإنجليزية')
      return
    }

    try {
      const newService = await addService({
        nameAr: baseServiceForm.nameAr,
        nameEn: baseServiceForm.nameEn,
        price: 0, // Base service has no price, only variants do
        duration: 0,
        category: 'custom',
        active: true,
      })

      if (newService?.id) {
        // Set this service to add variants
        setSelectedServiceForVariant(newService)
        setIsAddBaseServiceOpen(false)
        setBaseServiceForm({ nameAr: '', nameEn: '' })
        setIsAddVariantOpen(true)
      toast.success('✅ الخدمة الأساسية جاهزة - الآن أضف التفاصيل!', {
        duration: 3000,
        icon: '🎯'
      })
      }
    } catch (err) {
      toast.error(t('errors.database_error'))
      console.error('Error adding service:', err)
    }
  }

  // Add variant/detail
  const handleAddVariant = async () => {
    if (!variantForm.name || variantForm.price <= 0 || variantForm.duration <= 0) {
      toast.error('الرجاء تعبئة جميع البيانات (الاسم، السعر، المدة)')
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
      })

      // Reset form
      setVariantForm({ name: '', price: 0, duration: 30 })
      toast.success('✨ تم إضافة التفاصيل بنجاح!', {
        duration: 2500,
        icon: '💚'
      })
      
      // ✅ RELOAD VARIANTS FOR THIS SERVICE IMMEDIATELY
      try {
        const freshVariants = await getVariantsByServiceId(selectedServiceForVariant.id)
        setServiceVariantsMap(prev => ({
          ...prev,
          [selectedServiceForVariant.id]: freshVariants || []
        }))
      } catch (reloadErr) {
        console.error('Error reloading variants:', reloadErr)
      }
      
      // Ask if they want to add another variant
      const addAnother = window.confirm('هل تريد إضافة تفصيل آخر لنفس الخدمة؟')
      if (!addAnother) {
        setIsAddVariantOpen(false)
        setSelectedServiceForVariant(null)
      }
    } catch (err) {
      toast.error(t('errors.database_error'))
      console.error('Error adding variant:', err)
    }
  }

  // Delete variant
  const handleDeleteVariant = async (variantId: string) => {
    if (confirm('هل تريد حذف هذا التفصيل؟')) {
      try {
        await deleteVariant(variantId)
        toast.success('🗑️ تم حذف التفصيل', {
          duration: 2000,
          icon: '✨'
        })
        
        // Update the variant map
        const updated = { ...serviceVariantsMap }
        Object.keys(updated).forEach(serviceId => {
          updated[serviceId] = updated[serviceId].filter(v => v.id !== variantId)
        })
        setServiceVariantsMap(updated)
      } catch (err) {
        toast.error(t('errors.database_error'))
      }
    }
  }

  // Edit variant
  const handleEditVariant = async () => {
    if (!editVariantForm.name || editVariantForm.price <= 0 || editVariantForm.duration <= 0) {
      toast.error('الرجاء تعبئة جميع البيانات')
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
      })

      toast.success('✅ تم تحديث التفصيل بنجاح!', {
        duration: 2500,
        icon: '📝'
      })
      setIsEditVariantOpen(false)
      setEditingVariant(null)
      setEditVariantForm({ name: '', price: 0, duration: 30 })

      // Reload variants
      if (selectedServiceForVariant?.id) {
        const variants = await getVariantsByServiceId(selectedServiceForVariant.id)
        setServiceVariantsMap(prev => ({
          ...prev,
          [selectedServiceForVariant.id]: variants || []
        }))
      }
    } catch (err) {
      toast.error(t('errors.database_error'))
      console.error('Error updating variant:', err)
    }
  }

  // Delete base service
  const handleDeleteService = async (id: string) => {
    if (confirm('هل تريد حذف هذه الخدمة وجميع تفاصيلها؟')) {
      try {
        await deleteService(id)
        toast.success('✅ تم حذف الخدمة', {
          duration: 2000,
          icon: '🗑️'
        })
      } catch (err) {
        toast.error(t('errors.database_error'))
      }
    }
  }

  // Delete all services
  const handleDeleteAllServices = async () => {
    if (services.length === 0) {
      toast.error('لا توجد خدمات للحذف')
      return
    }

    if (confirm(`هل تريد بالفعل حذف جميع الخدمات (${services.length} خدمة)؟ هذا الإجراء لا يمكن التراجع عنه!`)) {
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
          toast.success(`✅ تم حذف ${deletedCount} خدمة بنجاح`, {
            duration: 3000,
            icon: '🎉'
          })
        } else {
          toast.error(`تم حذف ${deletedCount} خدمة. فشل: ${errors.length}`)
        }
      } catch (err) {
        toast.error(t('errors.database_error'))
      }
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
          <p className="text-sm text-gray-400 mt-1">أضف خدمة اساسية ثم أضف التفاصيل والأسعار</p>
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
            onClick={() => setIsAddBaseServiceOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg hover:bg-gold-400/30 transition"
          >
            <Plus size={20} />
            خدمة جديدة
          </motion.button>
        </div>
      </motion.div>

      {/* Services List  */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence>
          {services && services.length > 0 ? (
            services.map((service, idx) => {
              const serviceId = service.id || String(idx)
              const serviceVariants = serviceVariantsMap[serviceId] || []
              const isExpanded = expandedServiceId === serviceId

              return (
                <motion.div
                  key={serviceId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <GlassCard className="hover:border-gold-400/50 transition">
                    <div className="space-y-4">
                      {/* Base Service Header - CLICKABLE DROPDOWN */}
                      <button
                        onClick={() =>
                          setExpandedServiceId(isExpanded ? null : serviceId)
                        }
                        className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-lg transition group"
                      >
                        <div className="flex-1 text-left">
                          <h3 className="text-white font-bold text-lg group-hover:text-gold-400 transition">
                            {service.nameAr}
                          </h3>
                          <p className="text-xs text-gray-400">{service.nameEn}</p>
                          {serviceVariants.length > 0 && (
                            <p className="text-xs text-gold-400 mt-1">
                              📦 {serviceVariants.length} خيار متاح
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-3">
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
                            <ChevronUp size={20} className="text-gold-400" />
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
                              أضف تفصيل جديد
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
                                        : 'border-gold-400/20 hover:border-gold-400/40'
                                    } transition`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={`text-sm font-medium truncate ${
                                          !variant.isActive
                                            ? 'text-gray-400 line-through'
                                            : 'text-white'
                                        }`}
                                      >
                                        {variant.name}
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        ⏱️ {variant.duration || 30} دقيقة
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                                      <p className="text-gold-400 font-bold text-lg">
                                        {variant.price} ج.م
                                      </p>
                                      <button
                                        onClick={() => {
                                          setEditingVariant(variant)
                                          setEditVariantForm({
                                            name: variant.name,
                                            price: variant.price,
                                            duration: variant.duration,
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
                                        onClick={() =>
                                          handleDeleteVariant(variant.id)
                                        }
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
                  onClick={() => setIsAddBaseServiceOpen(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg hover:bg-gold-400/30 transition mx-auto"
                >
                  <Plus size={20} />
                  أضف أول خدمة
                </motion.button>
              </div>
            </GlassCard>
          )}
        </AnimatePresence>
      </div>

      {/* Add Base Service Modal */}
      <Modal
        isOpen={isAddBaseServiceOpen}
        onClose={() => {
          setIsAddBaseServiceOpen(false)
          setBaseServiceForm({ nameAr: '', nameEn: '' })
        }}
        title="أضف خدمة اساسية جديدة"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">اسم الخدمة بالعربية *</label>
            <input
              type="text"
              placeholder="مثال: عناية البشرة، قص الشعر، تشذيب اللحية"
              value={baseServiceForm.nameAr}
              onChange={(e) => setBaseServiceForm({ ...baseServiceForm, nameAr: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">المّ الخدمة الرئيسية (بدون سعر)</p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Service Name in English *</label>
            <input
              type="text"
              placeholder="Example: Skincare, Haircut, Beard Trim"
              value={baseServiceForm.nameEn}
              onChange={(e) => setBaseServiceForm({ ...baseServiceForm, nameEn: e.target.value })}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <motion.button
              onClick={handleAddBaseService}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 px-4 py-2 bg-gold-400 text-black rounded-lg font-semibold hover:bg-gold-500 transition"
            >
              التالي (أضف التفاصيل)
            </motion.button>
            <motion.button
              onClick={() => {
                setIsAddBaseServiceOpen(false)
                setBaseServiceForm({ nameAr: '', nameEn: '' })
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

      {/* Add Variant Modal */}
      <Modal
        isOpen={isAddVariantOpen}
        onClose={() => {
          setIsAddVariantOpen(false)
          setSelectedServiceForVariant(null)
          setVariantForm({ name: '', price: 0, duration: 30 })
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
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">السعر (ج.م) *</label>
              <input
                type="number"
                placeholder="مثال: 150"
                value={variantForm.price}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, price: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">المدة (دقائق) *</label>
              <input
                type="number"
                placeholder="30"
                value={variantForm.duration}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, duration: parseInt(e.target.value) || 30 })
                }
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400"
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
                setVariantForm({ name: '', price: 0, duration: 30 })
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
          setEditVariantForm({ name: '', price: 0, duration: 30 })
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
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">السعر (ج.م) *</label>
              <input
                type="number"
                placeholder="مثال: 150"
                value={editVariantForm.price}
                onChange={(e) =>
                  setEditVariantForm({ ...editVariantForm, price: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">المدة (دقائق) *</label>
              <input
                type="number"
                placeholder="30"
                value={editVariantForm.duration}
                onChange={(e) =>
                  setEditVariantForm({ ...editVariantForm, duration: parseInt(e.target.value) || 30 })
                }
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gold-400"
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
                setEditVariantForm({ name: '', price: 0, duration: 30 })
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
    </div>
  )
}
