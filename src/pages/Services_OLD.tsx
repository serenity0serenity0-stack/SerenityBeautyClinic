import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { Modal } from '../components/ui/Modal'
import { useServices } from '../db/hooks/useServices'
import { useServiceVariants } from '../db/hooks/useServiceVariants'
import { useAuth } from '../hooks/useAuth'
import { motion } from 'framer-motion'
import { Trash2, Edit2, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

export const Services: React.FC = () => {
  const { t } = useTranslation()
  const { services, addService, deleteService, updateService } = useServices()
  const { addVariant, deleteVariant } = useServiceVariants()
  const { clinicId } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('haircut')
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null)
  const [serviceVariantsMap, setServiceVariantsMap] = useState<{[key: string]: any[]}>({})
  const [formData, setFormData] = useState({
    nameAr: '',
    nameEn: '',
    price: 0,
    duration: 0,
    category: 'haircut',
  })
  const [variants, setVariants] = useState<Array<{name: string; price: number}>>([])
  const [newVariant, setNewVariant] = useState({name: '', price: 0})

  const categories = ['haircut', 'beard', 'skincare', 'kids', 'packages']

  // Load variants for all services  
  useEffect(() => {
    const loadAllVariants = async () => {
      // For now, just initialize empty map - variants are loaded separately
      const variantsMap: {[key: string]: any[]} = {}
      setServiceVariantsMap(variantsMap)
    }

    if (services.length > 0) {
      loadAllVariants()
    }
  }, [services])

  const openAddModal = () => {
    setEditingServiceId(null)
    setFormData({ nameAr: '', nameEn: '', price: 0, duration: 0, category: 'haircut' })
    setVariants([])
    setNewVariant({name: '', price: 0})
    setIsModalOpen(true)
  }

  const openEditModal = (service: any) => {
    setEditingServiceId(service.id)
    setFormData({
      nameAr: service.nameAr,
      nameEn: service.nameEn,
      price: service.price,
      duration: service.duration,
      category: service.category,
    })
    setVariants([])
    setNewVariant({name: '', price: 0})
    setIsModalOpen(true)
  }

  const handleAddVariantToList = () => {
    if (!newVariant.name || newVariant.price <= 0) {
      toast.error('أضف اسم النوع والسعر')
      return
    }
    setVariants([...variants, newVariant])
    setNewVariant({name: '', price: 0})
  }

  const handleRemoveVariant = (idx: number) => {
    setVariants(variants.filter((_, i) => i !== idx))
  }

  const handleSaveService = async () => {
    if (!formData.nameAr || !formData.price) {
      toast.error(t('errors.required_field'))
      return
    }

    try {
      if (editingServiceId) {
        // Update existing service
        await updateService(editingServiceId, {
          nameAr: formData.nameAr,
          nameEn: formData.nameEn,
          price: formData.price,
          duration: formData.duration,
          category: formData.category,
        })
        toast.success('تم تحديث الخدمة')
      } else {
        // Add new service
        const service = await addService({
          ...formData,
          active: true,
        })

        // Add variants if any
        if (variants.length > 0 && service?.id) {
          for (const variant of variants) {
            await addVariant({
              clinic_id: clinicId as string,
              service_id: service.id,
              name: variant.name,
              price: variant.price,
              isActive: true,
            })
          }
        }
        toast.success(t('notifications.service_added'))
      }
      setFormData({ nameAr: '', nameEn: '', price: 0, duration: 0, category: 'haircut' })
      setVariants([])
      setNewVariant({name: '', price: 0})
      setIsModalOpen(false)
      setEditingServiceId(null)
    } catch (err) {
      toast.error(t('errors.database_error'))
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('هل تريد حذف هذه الخدمة؟')) {
      try {
        await deleteService(id)
        toast.success(t('notifications.service_deleted'))
      } catch (err) {
        toast.error(t('errors.database_error'))
      }
    }
  }

  const handleDeleteVariant = async (variantId: string) => {
    if (confirm('هل تريد حذف هذا النوع؟')) {
      try {
        await deleteVariant(variantId)
        toast.success('تم حذف النوع')
        // Refresh variants
        const updated = {...serviceVariantsMap}
        Object.keys(updated).forEach(serviceId => {
          updated[serviceId] = updated[serviceId].filter(v => v.id !== variantId)
        })
        setServiceVariantsMap(updated)
      } catch (err) {
        toast.error(t('errors.database_error'))
      }
    }
  }

  const filteredServices = selectedCategory
    ? services.filter((s) => s.category === selectedCategory)
    : services

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">{t('services.title')}</h1>
        <motion.button
          onClick={openAddModal}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg hover:bg-gold-400/30 transition"
        >
          <Plus size={20} />
          {t('services.add_service')}
        </motion.button>
      </motion.div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
              selectedCategory === cat
                ? 'bg-gold-400/20 text-gold-400 border border-gold-400/20'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {t(`pos.categories.${cat}`)}
          </button>
        ))}
      </div>

      {/* Services Grid - Card Based Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((service, idx) => {
          const serviceId = service.id || String(idx)
          const serviceVariants = serviceVariantsMap[serviceId] || []
          const isExpanded = expandedServiceId === serviceId

          return (
            <motion.div
              key={serviceId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <GlassCard>
                <div className="space-y-4">
                  {/* Service Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-white font-bold text-lg">{service.nameAr}</p>
                      <p className="text-xs text-gray-400 mb-2">{service.nameEn}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-gold-400 font-bold text-xl">{service.price} ج.م</span>
                        <span className="text-xs text-gray-400">⏱️ {service.duration} دقائق</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(service)}
                        className="p-2 hover:bg-white/10 rounded transition"
                        title="تعديل الخدمة"
                      >
                        <Edit2 size={18} className="text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(service.id!)}
                        className="p-2 hover:bg-red-500/10 rounded transition"
                        title="حذف الخدمة"
                      >
                        <Trash2 size={18} className="text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Variants Section */}
                  {serviceVariants.length > 0 && (
                    <div className="border-t border-white/10 pt-3">
                      <button
                        onClick={() =>
                          setExpandedServiceId(isExpanded ? null : serviceId)
                        }
                        className="w-full flex items-center justify-between p-2 hover:bg-white/5 rounded transition"
                      >
                        <span className="text-sm text-gray-300">
                          الأنواع ({serviceVariants.length})
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={16} className="text-gold-400" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-400" />
                        )}
                      </button>

                      {/* Expanded Variants List */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 space-y-2 border-t border-white/10 pt-3"
                        >
                          {serviceVariants.map((variant: any) => (
                            <div
                              key={variant.id}
                              className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10"
                            >
                              <div className="flex-1">
                                <p className="text-white text-sm font-medium">
                                  {variant.name}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
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
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          )
        })}
      </div>

      {/* Add/Edit Service Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingServiceId(null)
          setFormData({ nameAr: '', nameEn: '', price: 0, duration: 0, category: 'haircut' })
          setVariants([])
          setNewVariant({name: '', price: 0})
        }}
        title={editingServiceId ? 'تعديل الخدمة' : t('services.add_service')}
        size="lg"
      >
        <div className="space-y-6 max-h-96 overflow-y-auto">
          {/* Base Service Info */}
          <div className="space-y-4 pb-4 border-b border-white/10">
            <h3 className="text-white font-semibold">معلومات الخدمة</h3>
            
            <div>
              <label className="block text-sm text-gray-300 mb-1">اسم الخدمة بالعربية *</label>
              <input
                type="text"
                placeholder="مثال: قص شعر، حلاقة لحية، عناية بالبشرة"
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">اسم الخدمة الذي سيظهر في الفاتورة والإيصالات</p>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Service Name in English *</label>
              <input
                type="text"
                placeholder="Example: Haircut, Beard Trim, Skincare"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Service name for English display</p>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">السعر الأساسي (ج.م) *</label>
              <input
                type="number"
                placeholder="مثال: 50"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">السعر الافتراضي للخدمة بالجنيه المصري</p>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">المدة (دقائق)</label>
              <input
                type="number"
                placeholder="مثال: 30"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">الوقت المتوقع لإنهاء الخدمة (للمعلومات فقط)</p>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">فئة الخدمة</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`pos.categories.${cat}`)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">تصنيف الخدمة لتنظيم أفضل</p>
            </div>
          </div>

          {/* Service Variants - Only show for new services */}
          {!editingServiceId && (
            <div className="space-y-4">
              <h3 className="text-white font-semibold">أنواع الخدمة (اختياري)</h3>
              <p className="text-xs text-gray-400">
                أنواع مختلفة من نفس الخدمة بأسعار مختلفة. مثال: قص شعر عادي = 40 ج.م، قص فاخر = 75 ج.م
              </p>
              <div className="bg-white/5 p-4 rounded-lg space-y-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">نوع الخدمة بالعربية</label>
                  <input
                    type="text"
                    placeholder="مثال: قص عادي، قص فاخر، باقة كاملة"
                    value={newVariant.name}
                    onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">تفاصيل نوع الخدمة</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">سعر النوع (ج.م)</label>
                  <input
                    type="number"
                    placeholder="مثال: 75"
                    value={newVariant.price}
                    onChange={(e) => setNewVariant({...newVariant, price: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">السعر لهذا النوع من الخدمة</p>
                </div>

                <button
                  onClick={handleAddVariantToList}
                  className="w-full px-3 py-2 bg-gold-400/10 text-gold-400 border border-gold-400/20 rounded hover:bg-gold-400/20 transition"
                >
                  + إضافة نوع
                </button>
              </div>

              {/* Added Variants List */}
              {variants.length > 0 && (
                <div className="space-y-2">
                  <p className="text-gray-400 text-sm">الأنواع المضافة ({variants.length}):</p>
                  {variants.map((v, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded border border-white/10">
                      <div>
                        <p className="text-white text-sm">{v.name}</p>
                        <p className="text-xs text-gray-400">{v.price}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-gold-400 font-bold">{v.price} ج.م</p>
                        <button
                          onClick={() => handleRemoveVariant(idx)}
                          className="p-1 hover:bg-red-500/10 rounded transition"
                        >
                          <X size={16} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              onClick={() => {
                setIsModalOpen(false)
                setEditingServiceId(null)
                setFormData({ nameAr: '', nameEn: '', price: 0, duration: 0, category: 'haircut' })
                setVariants([])
                setNewVariant({name: '', price: 0})
              }}
              className="flex-1 px-4 py-2 border border-white/20 rounded-lg hover:bg-white/5 transition"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSaveService}
              className="flex-1 px-4 py-2 bg-gold-400/20 text-gold-400 border border-gold-400/20 rounded-lg font-bold hover:bg-gold-400/30 transition"
            >
              {editingServiceId ? 'تحديث' : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
