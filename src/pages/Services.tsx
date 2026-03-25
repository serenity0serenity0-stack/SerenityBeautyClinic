import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Modal } from '../components/ui/Modal'
import { useServices } from '../db/hooks/useServices'
import { useServiceVariants } from '../db/hooks/useServiceVariants'
import { useAuth } from '../hooks/useAuth'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

export const Services: React.FC = () => {
  const { t } = useTranslation()
  const { services, addService, deleteService } = useServices()
  const { addVariant, deleteVariant } = useServiceVariants()
  const { clinicId } = useAuth()
  
  // Modals
  const [isAddBaseServiceOpen, setIsAddBaseServiceOpen] = useState(false)
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false)
  const [selectedServiceForVariant, setSelectedServiceForVariant] = useState<any>(null)
  
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

  // Load all service variants on mount
  useEffect(() => {
    const loadAllVariants = async () => {
      const variantsMap: {[key: string]: any[]} = {}
      
      for (const service of services) {
        if (!service.id) continue
        try {
          // For now, we'd need to fetch variants from a method
          // This is a placeholder - in real implementation, you might use getVariantsByServiceId
          variantsMap[service.id] = []
        } catch (err) {
          console.error(`Failed to load variants for service ${service.id}:`, err)
        }
      }
      
      setServiceVariantsMap(variantsMap)
    }

    if (services.length > 0) {
      loadAllVariants()
    }
  }, [services])

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
        toast.success('✅ تم إضافة الخدمة الأساسية. الآن أضف التفاصيل!')
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
      toast.success('✅ تم إضافة التفاصيل بنجاح')
      
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
        toast.success('تم حذف التفصيل')
        
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

  // Delete base service
  const handleDeleteService = async (id: string) => {
    if (confirm('هل تريد حذف هذه الخدمة وجميع تفاصيلها؟')) {
      try {
        await deleteService(id)
        toast.success('تم حذف الخدمة')
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
        <motion.button
          onClick={() => setIsAddBaseServiceOpen(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg hover:bg-gold-400/30 transition"
        >
          <Plus size={20} />
          خدمة جديدة
        </motion.button>
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
                      {/* Base Service Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-white font-bold text-lg">{service.nameAr}</h3>
                          <p className="text-xs text-gray-400">{service.nameEn}</p>
                          <p className="text-xs text-gray-500 mt-1">👤 خدمة اساسية</p>
                        </div>
                        <button
                          onClick={() => handleDeleteService(service.id!)}
                          className="p-2 hover:bg-red-500/10 rounded transition"
                          title="حذف الخدمة"
                        >
                          <Trash2 size={18} className="text-red-400" />
                        </button>
                      </div>

                      {/* Add Variant Button */}
                      <div className="border-t border-white/10 pt-3">
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
                          أضف تفصيل + سعر + وقت
                        </motion.button>
                      </div>

                      {/* Variants List */}
                      {serviceVariants.length > 0 && (
                        <div className="border-t border-white/10 pt-3">
                          <button
                            onClick={() =>
                              setExpandedServiceId(isExpanded ? null : serviceId)
                            }
                            className="w-full flex items-center justify-between p-2 hover:bg-white/5 rounded transition"
                          >
                            <span className="text-sm font-semibold text-white">
                              التفاصيل ({serviceVariants.length})
                            </span>
                            {isExpanded ? (
                              <ChevronUp size={16} className="text-gold-400" />
                            ) : (
                              <ChevronDown size={16} className="text-gray-400" />
                            )}
                          </button>

                          {/* Expanded Variants */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 space-y-2"
                              >
                                {serviceVariants.map((variant: any) => (
                                  <motion.div
                                    key={variant.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white text-sm font-medium truncate">
                                        {variant.name}
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        ⏱️ {variant.duration || 30} دقيقة
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                                      <p className="text-gold-400 font-bold text-sm">
                                        {variant.price} ج.م
                                      </p>
                                      <button
                                        onClick={() =>
                                          handleDeleteVariant(variant.id)
                                        }
                                        className="p-1 hover:bg-red-500/10 rounded transition"
                                      >
                                        <X size={14} className="text-red-400" />
                                      </button>
                                    </div>
                                  </motion.div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
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
    </div>
  )
}
