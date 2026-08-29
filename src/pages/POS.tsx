import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Modal } from '../components/ui/Modal'
import { ReceiptTemplate } from '../components/receipt/ReceiptTemplate'
import {
  X, Search, Trash2, Printer, Check, ChevronUp, ChevronDown,
  Plus, Minus, AlertTriangle, Boxes,
} from 'lucide-react'
import { useClients } from '../db/hooks/useClients'
import { useServices } from '../db/hooks/useServices'
import { useServiceVariants } from '../db/hooks/useServiceVariants'
import { useBarbers } from '../db/hooks/useBarbers'
import { useSales } from '../db/hooks/useSales'
import { useBalanceData } from '../db/hooks/useBalanceData'
import { checkSubscriptionStatus } from '../utils/subscriptionChecker'
import { appEmitter } from '../utils/eventEmitter'
import { getEgyptDateString, getEgyptTimeString } from '../utils/egyptTime'
import type { ClientBalanceSummary } from '../db/supabase'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'

// ✅ Normalize search input - fix Arabic keyboard/IME issues
const normalizeSearchInput = (value: string): string => {
  if (!value) return ''

  const arabicToEnglish: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  }

  let normalized = value
  for (const [arabic, english] of Object.entries(arabicToEnglish)) {
    normalized = normalized.replace(new RegExp(arabic, 'g'), english)
  }
  normalized = normalized.replace(/[^\u0621-\u064Ea-zA-Z0-9\s\-+]/g, '')

  return normalized.trim()
}

interface CartItem {
  key: string
  service_id: string
  variant_id?: string | null
  name: string
  unit_price: number
  quantity: number
  service_type: string
  unit_label?: string | null
  package_quantity?: number | null
  bonus_quantity?: number | null
}

interface ReceiptLine {
  name: string
  price: number
  quantity: number
}

interface CompletedTransaction {
  transactionId: string
  invoiceNo: number
  client_name: string
  client_phone: string
  barber_name?: string
  date: string
  time: string
  items: ReceiptLine[]
  subtotal: number
  discount: number
  discount_type: 'percentage' | 'fixed'
  total: number
  payment_method: string
}

const categoryLabels: Record<string, string> = {
  hair: 'الشعر',
  skincare: 'العناية بالبشرة',
  body: 'الجسم',
  nails: 'الأظافر',
  makeup: 'المكياج',
  packages: 'الاشتراكات والباقات',
  pulses: 'نبضات (Pulses)',
  sessions: 'الجلسات',
}

export const POS: React.FC = () => {
  const { clients, updateClient } = useClients()
  const { services } = useServices()
  const { getVariantsByServiceId } = useServiceVariants()
  const { barbers } = useBarbers()
  const { completeSale } = useSales()
  const { getBalanceSummaryByClient } = useBalanceData()
  const { clinicId } = useAuth()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [clientBalance, setClientBalance] = useState<ClientBalanceSummary[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [discount_type, setdiscount_type] = useState<'percentage' | 'fixed'>('fixed')
  const [allVariants, setAllVariants] = useState<{ [key: string]: any[] }>({})
  const [payment_method, setpayment_method] = useState('cash')
  const [showClientSearch, setShowClientSearch] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [completedTransaction, setCompletedTransaction] = useState<CompletedTransaction | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [selectedBarber, setSelectedBarber] = useState<any>(null)
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null)
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>(
    () => (localStorage.getItem('receiptPaperWidth') as '80mm' | '58mm') || '80mm'
  )
  const receiptRef = useRef<HTMLDivElement>(null)
  const printInProgress = useRef(false)

  // Inject the thermal @page size so the print dialog matches the selected paper.
  useEffect(() => {
    let el = document.getElementById('thermal-page-size') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'thermal-page-size'
      document.head.appendChild(el)
    }
    el.textContent = `@media print { @page { size: ${paperWidth} auto; margin: 0; } }`
  }, [paperWidth])

  // Load variants per service
  useEffect(() => {
    const loadAllVariants = async () => {
      const variants: { [key: string]: any[] } = {}
      for (const service of services) {
        if (!service.id) continue
        try {
          const serviceVariants = await getVariantsByServiceId(service.id)
          if (serviceVariants && serviceVariants.length > 0) {
            variants[service.id] = serviceVariants
          }
        } catch { /* no variants */ }
      }
      setAllVariants(variants)
    }

    if (services.length > 0) {
      loadAllVariants()
    }
  }, [services, getVariantsByServiceId])

  // Load the selected client's balance so the cashier can warn about existing balances
  useEffect(() => {
    if (!selectedClient) {
      setClientBalance([])
      return
    }
    let cancelled = false
    getBalanceSummaryByClient(selectedClient.id).then((rows) => {
      if (!cancelled) setClientBalance(rows)
    })
    return () => { cancelled = true }
  }, [selectedClient, getBalanceSummaryByClient])

  // Group services by category
  const groupedServices = services.reduce<Record<string, typeof services>>((acc, s) => {
    const key = s.category || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const balanceFor = (serviceId: string) =>
    clientBalance.find((b) => b.service_id === serviceId)

  const searchResults = (() => {
    const normalized = normalizeSearchInput(searchQuery)
    if (!normalized) return []

    const q = normalized.trim().toLowerCase()
    const isNumeric = /^\d+$/.test(q)

    const filtered = clients.filter((client) => {
      if (isNumeric) {
        return client.phone?.toLowerCase().includes(q) || false
      }
      return (
        client.name?.toLowerCase().includes(q) ||
        client.phone?.toLowerCase().includes(q)
      )
    })

    return filtered.map((item) => ({ item, score: 0 } as any))
  })()

  const addToCart = (service: any, variant?: any) => {
    const name = variant
      ? `${service.nameAr || service.name || 'خدمة'} - ${variant.name}`
      : service.nameAr || service.name || 'خدمة'
    const price = variant ? variant.price : service.price

    setCart((prev) => {
      const existing = prev.find((i) =>
        i.service_id === service.id && (i.variant_id || null) === (variant?.id || null)
      )
      if (existing) {
        return prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          key: Math.random().toString(36).slice(2),
          service_id: service.id,
          variant_id: variant?.id || null,
          name,
          unit_price: price,
          quantity: 1,
          service_type: variant?.service_type || service.service_type || 'regular',
          unit_label: variant?.unit_label || service.unit_label || null,
          package_quantity: variant?.package_quantity ?? service.package_quantity ?? null,
          bonus_quantity: variant?.bonus_quantity ?? service.bonus_quantity ?? 0,
        },
      ]
    })

    const bal = balanceFor(service.id)
    if (bal && bal.remaining > 0) {
      toast(`⚠️ العميل لديه رصيد متبقي: ${bal.remaining} ${bal.unit_label || ''}`)
    } else {
      toast.success('✅ تم اضافة الخدمة')
    }
  }

  const changeQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i))
    )
  }

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((i) => i.key !== key))
  }

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const discountAmount =
    discount_type === 'percentage'
      ? (subtotal * Math.min(Math.max(discount, 0), 100)) / 100
      : discount
  const total = Math.max(subtotal - discountAmount, 0)

  const handleCompleteSale = async () => {
    if (!selectedClient) {
      toast.error('اختر العميل أولاً')
      return
    }
    if (cart.length === 0) {
      toast.error('السلة فارغة')
      return
    }

    try {
      const subStatus = await checkSubscriptionStatus(clinicId || '')
      if (!subStatus.isActive) {
        const messages: Record<string, string> = {
          inactive: 'اشتراكك غير نشط. يرجى تفعيل الاشتراك',
          suspended: 'تم إيقاف اشتراكك. يرجى التواصل مع الدعم',
          expired: 'انتهى صلاحية اشتراكك. يرجى تجديد الاشتراك',
        }
        toast.error(messages[subStatus.status] || 'اشتراكك غير صالح')
        return
      }
    } catch {
      toast.error('فشل التحقق من صلاحية الاشتراك')
      return
    }

    try {
      setIsCheckingOut(true)
      const dateStr = getEgyptDateString()
      const timeStr = getEgyptTimeString()

      const result = await completeSale({
        client_id: selectedClient.id,
        items: cart.map((i) => ({
          service_id: i.service_id,
          quantity: i.quantity,
          variant_id: i.variant_id,
        })),
        discount,
        discount_type,
        payment_method: payment_method as 'cash' | 'card' | 'wallet',
        barber_id: selectedBarber?.id || null,
        notes: '',
      })

      if (!result) throw new Error('فشلت عملية البيع')

      const transactionId = result.transaction_id
      const invoiceNo = result.invoice_no

      // Update client (optimistic; server-side RPC also updates totals)
      await updateClient(selectedClient.id, {
        total_visits: (selectedClient.total_visits || 0) + 1,
        total_spent: (selectedClient.total_spent || 0) + total,
        last_visit: dateStr,
      })

      setCompletedTransaction({
        transactionId,
        invoiceNo,
        client_name: selectedClient.name,
        client_phone: selectedClient.phone,
        barber_name: selectedBarber?.name || '',
        date: dateStr,
        time: timeStr,
        items: cart.map((item) => ({
          name:
            item.service_type === 'package' && item.package_quantity
              ? `${item.name} (باقة ${item.package_quantity}${item.unit_label || ''})`
              : item.name,
          price: item.unit_price,
          quantity: item.quantity,
          unitLabel: item.unit_label || '',
          bonusQuantity: item.service_type === 'package' ? item.bonus_quantity || 0 : 0,
        })),
        subtotal,
        discount: discountAmount,
        discount_type,
        total,
        payment_method,
      })
      setShowReceipt(true)
      toast.success('✅ تمت العملية بنجاح!')

      // Reset form
      setCart([])
      setDiscount(0)
      setSelectedClient(null)
      setClientBalance([])
      appEmitter.emit('transaction:created', { total, date: dateStr })
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const handlePrint = () => {
    if (printInProgress.current) return
    printInProgress.current = true

    const release = () => { printInProgress.current = false }

    window.addEventListener('afterprint', release, { once: true })
    window.setTimeout(release, 5000)

    const doPrint = () => {
      try {
        window.print()
      } catch {
        release()
      }
    }

    if (document.fonts?.ready) {
      document.fonts.ready.then(doPrint).catch(doPrint)
    } else {
      doPrint()
    }
  }

  return (
    <div className="h-screen app-shell overflow-hidden flex flex-col">
      {/* Header */}
      <div className="glass-dark border-b border-white/10 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between z-20">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">💰 كاشير</h1>
          <p className="text-xs text-gray-400 mt-1">
            {selectedClient ? `${selectedClient.name} ✓` : 'لم يتم اختيار عميل'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs">الإجمالي</p>
          <p className="text-3xl md:text-4xl font-bold text-pink-400">
            {total.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400">ج.م</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-0 md:gap-4 p-0 md:p-4">
        {/* Left: Services */}
        <div className="flex-1 flex flex-col overflow-hidden md:rounded-lg md:border md:border-white/10 md:bg-white/5">
          {/* Client Selection Bar */}
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-white/10 flex-shrink-0">
            {selectedClient ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-gradient-to-r from-pink-400/10 to-sky-blue/10 border border-pink-500/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-white font-bold text-lg">{selectedClient.name}</p>
                    <p className="text-xs text-gray-300">{selectedClient.phone}</p>
                  </div>
                  <motion.button
                    onClick={() => setSelectedClient(null)}
                    whileHover={{ scale: 1.1 }}
                    className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition"
                  >
                    <X size={20} />
                  </motion.button>
                </div>

                {/* Existing balance warning strip */}
                {clientBalance.filter((b) => b.remaining > 0).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {clientBalance
                      .filter((b) => b.remaining > 0)
                      .map((b) => (
                        <span
                          key={b.service_id}
                          className="text-[11px] font-semibold bg-blue-500/10 border border-blue-500/40 text-blue-300 rounded-full px-3 py-1"
                        >
                          {b.service_name}: {b.remaining} {b.unit_label || ''}
                          {b.earliest_expiry ? ` ⏰ ${b.earliest_expiry}` : ''}
                        </span>
                      ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.button
                onClick={() => setShowClientSearch(true)}
                whileHover={{ scale: 1.01 }}
                className="w-full p-4 border-2 border-dashed border-pink-500/40 hover:border-pink-500 rounded-lg transition flex items-center justify-center gap-2 text-pink-400 font-bold text-center"
              >
                <Search size={20} />
                <span>اختر عميل</span>
              </motion.button>
            )}
          </div>

          {/* Services Grid */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            <h2 className="text-lg font-bold text-white sticky top-0 fade-top z-10">
              📋 الخدمات
            </h2>

            {Object.entries(groupedServices).map(([category, list]) => (
              <div key={category}>
                <h3 className="text-sm font-bold text-pink-400 mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-pink-500 rounded-full inline-block" />
                  {categoryLabels[category] || category}
                </h3>

                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {list.map((service, idx) => {
                      const serviceId = service.id || String(idx)
                      const variants = (service.id && allVariants[service.id]) || []
                      const isExpanded = expandedServiceId === serviceId
                      const isPackage = service.service_type === 'package'
                      const bal = service.id ? balanceFor(service.id) : undefined

                      return (
                        <motion.div
                          key={serviceId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: idx * 0.02 }}
                          className="group"
                        >
                          {/* Service header */}
                          <div
                            className={
                              isPackage
                                ? 'w-full p-3 rounded-lg border bg-gradient-to-r from-purple-500/20 to-pink-500/10 border-purple-500/40'
                                : 'w-full p-3 rounded-lg border bg-gradient-to-r from-white/10 to-white/5 border-white/20'
                            }
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 text-right">
                                <div className="flex items-center gap-2">
                                  {isPackage && <Boxes size={16} className="text-purple-400" />}
                                  <h3 className="text-white font-bold text-sm md:text-base">
                                    {service.nameAr}
                                  </h3>
                                </div>

                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {isPackage && service.package_quantity ? (
                                    <span className="text-[10px] font-bold bg-purple-500/20 border border-purple-500/40 text-purple-300 rounded-full px-2 py-0.5">
                                      {service.package_quantity} {service.unit_label || ''}
                                      {(service.bonus_quantity || 0) > 0
                                        ? ` + ${service.bonus_quantity} ${service.unit_label || ''} بونص`
                                        : ''}
                                    </span>
                                  ) : null}
                                  {isPackage && service.expiry_value && service.expiry_unit ? (
                                    <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full px-2 py-0.5">
                                      ⏰ صالحة {service.expiry_value} {service.expiry_unit === 'days' ? 'يوم' : service.expiry_unit === 'weeks' ? 'أسبوع' : 'شهر'}
                                    </span>
                                  ) : null}
                                  {variants.length > 0 && (
                                    <span className="text-[10px] text-pink-400">
                                      📦 {variants.length} خيار متاح
                                    </span>
                                  )}
                                  {bal && bal.remaining > 0 && (
                                    <span className="text-[10px] font-bold flex items-center gap-1 text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-full px-2 py-0.5">
                                      <AlertTriangle size={10} />
                                      لديه رصيد: {bal.remaining} {bal.unit_label || ''}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mr-3 text-left flex-shrink-0">
                                {variants.length > 0 ? (
                                  <button
                                    onClick={() => setExpandedServiceId(isExpanded ? null : serviceId)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp size={20} className="text-pink-400" />
                                    ) : (
                                      <ChevronDown size={20} className="text-gray-400" />
                                    )}
                                  </button>
                                ) : (
                                  <motion.button
                                    onClick={() => addToCart(service)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-sm font-bold rounded-lg transition flex-shrink-0"
                                  >
                                    + أضف
                                  </motion.button>
                                )}
                                <p className="text-pink-400 font-bold text-sm">{service.price} ج.م</p>
                              </div>
                            </div>
                          </div>

                          {/* Expanded variant list */}
                          <AnimatePresence>
                            {isExpanded && variants.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-1 mt-1 ml-2 border-l-2 border-pink-500/30 pl-2"
                              >
                                {variants.map((variant: any) => (
                                  <motion.button
                                    key={variant.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    onClick={() => addToCart(service, variant)}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/30 rounded transition text-left"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white text-sm truncate">{variant.name}</p>
                                      <p className="text-xs text-gray-400">⏱️ {variant.duration || 30} دقيقة</p>
                                      {(variant.service_type === 'package' || variant.service_type == null && isPackage) && (variant.package_quantity || (isPackage && service.package_quantity)) ? (
                                        <p className="text-[10px] text-purple-300 mt-0.5">
                                          {variant.package_quantity ?? service.package_quantity} {variant.unit_label || service.unit_label || ''}
                                          {((variant.bonus_quantity ?? service.bonus_quantity) || 0) > 0
                                            ? ` + ${variant.bonus_quantity ?? service.bonus_quantity} بونص`
                                            : ''}
                                        </p>
                                      ) : null}
                                    </div>
                                    <p className="text-pink-400 font-bold text-sm ml-2 flex-shrink-0">
                                      {variant.price} ج.م
                                    </p>
                                  </motion.button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}

            {services.length === 0 && (
              <p className="text-center text-gray-500 py-10">لا توجد خدمات - أضف الخدمات من صفحة الخدمات</p>
            )}
          </div>
        </div>

        {/* Right: Cart & Checkout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full md:w-96 flex flex-col bg-gradient-to-br from-white/10 to-white/5 border-t md:border-t-0 md:border border-white/10 rounded-t-2xl md:rounded-lg p-4 md:p-6 space-y-4 overflow-hidden"
        >
          {/* Cart Header */}
          <div className="flex items-center justify-between sticky top-0 fade-top -mx-4 md:-mx-6 px-4 md:px-6 py-2">
            <h2 className="text-lg md:text-xl font-bold text-white">🛒 السلة</h2>
            <span className="text-sm font-semibold bg-gradient-to-r from-pink-600 to-pink-700/20 text-pink-400 px-3 py-1 rounded-full">
              {cart.length} صنف
            </span>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-16">
            <AnimatePresence mode="popLayout">
              {cart.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex items-center justify-center"
                >
                  <p className="text-gray-500 text-center text-sm">السلة فارغة حالياً</p>
                </motion.div>
              ) : (
                cart.map((item) => (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                        <p className="text-pink-400 font-bold text-sm">
                          {item.unit_price} ج.م {item.quantity > 1 ? `× ${item.quantity}` : ''}
                        </p>
                      </div>
                      <motion.button
                        onClick={() => removeFromCart(item.key)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition flex-shrink-0"
                      >
                        <Trash2 size={18} />
                      </motion.button>
                    </div>

                    {/* Quantity stepper */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-gray-400 ml-auto">الكمية</span>
                      <motion.button
                        onClick={() => changeQty(item.key, 1)}
                        whileTap={{ scale: 0.9 }}
                        className="w-7 h-7 flex items-center justify-center bg-pink-600/30 hover:bg-pink-600 text-white rounded-lg"
                      >
                        <Plus size={14} />
                      </motion.button>
                      <span className="w-8 text-center text-white font-bold text-sm">{item.quantity}</span>
                      <motion.button
                        onClick={() => changeQty(item.key, -1)}
                        whileTap={{ scale: 0.9 }}
                        disabled={item.quantity <= 1}
                        className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg disabled:opacity-40"
                      >
                        <Minus size={14} />
                      </motion.button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Totals & Checkout */}
          {cart.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3 border-t border-white/10 pt-4 sticky bottom-0 fade-bottom -mx-4 md:-mx-6 px-4 md:px-6 py-4"
            >
              <div className="flex justify-between text-gray-400 text-sm">
                <span>قبل الخصم:</span>
                <span className="font-semibold">{subtotal.toFixed(2)} ج.م</span>
              </div>

              {/* Discount */}
              <div className="flex gap-2">
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="الخصم"
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500"
                />
                <select
                  value={discount_type}
                  onChange={(e) => setdiscount_type(e.target.value as 'percentage' | 'fixed')}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                >
                  <option value="fixed">ج.م</option>
                  <option value="percentage">%</option>
                </select>
              </div>

              {/* Final Total */}
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="text-white font-bold">الإجمالي</span>
                <span className="text-2xl font-bold text-pink-400">{total.toFixed(2)}</span>
              </div>

              {/* Payment Method */}
              <select
                value={payment_method}
                onChange={(e) => setpayment_method(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
              >
                <option value="cash">💵 نقد</option>
                <option value="card">💳 بطاقة</option>
                <option value="wallet">📱 محفظة</option>
              </select>

              {/* Doctor Selection */}
              <select
                value={selectedBarber?.id || ''}
                onChange={(e) => {
                  const barber = barbers.find((b) => b.id === e.target.value)
                  setSelectedBarber(barber || null)
                }}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
              >
                <option value="">اختر الطبيب (اختياري)</option>
                {barbers.filter((b) => b.active).map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>

              {/* Checkout Button */}
              <motion.button
                onClick={handleCompleteSale}
                disabled={isCheckingOut || !selectedClient || cart.length === 0}
                whileHover={!isCheckingOut && selectedClient ? { scale: 1.02, y: -2 } : {}}
                whileTap={!isCheckingOut && selectedClient ? { scale: 0.98 } : {}}
                className="w-full p-4 bg-gradient-to-r from-pink-600 to-pink-700 text-white font-bold text-base md:text-lg rounded-xl hover:shadow-2xl hover:shadow-pink-400/40 disabled:opacity-50 disabled:cursor-not-allowed transition transform"
              >
                {isCheckingOut ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-black border-t-transparent rounded-full"
                    />
                    جاري المعالجة...
                  </span>
                ) : (
                  '✅ إتمام البيع'
                )}
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Client Search Modal */}
      <Modal
        isOpen={showClientSearch}
        onClose={() => {
          setShowClientSearch(false)
          setSearchQuery('')
        }}
        title="🔍 اختر العميل"
        size="md"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search size={18} className="absolute right-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث باسم أو هاتف"
              value={searchQuery}
              onChange={(e) => {
                const normalizedValue = normalizeSearchInput(e.currentTarget.value)
                setSearchQuery(normalizedValue)
              }}
              autoFocus
              className="w-full pl-4 pr-10 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500"
            />
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {searchResults.length > 0 ? (
                searchResults.map(({ item }: any, idx: number) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => {
                      setSelectedClient(item)
                      setShowClientSearch(false)
                      setSearchQuery('')
                    }}
                    whileHover={{ scale: 1.02, x: 8 }}
                    className="w-full p-4 bg-white/5 hover:bg-gradient-to-r from-pink-600 to-pink-700/10 border border-white/10 hover:border-pink-500/30 rounded-lg text-left transition"
                  >
                    <p className="text-white font-semibold">{item.name}</p>
                    <p className="text-xs text-gray-400">📞 {item.phone}</p>
                    <p className="text-xs text-pink-400 mt-1">
                      {item.total_visits} زيارات • {(item.total_spent || 0).toFixed(2)} ج.م
                    </p>
                  </motion.button>
                ))
              ) : searchQuery ? (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-gray-400 py-6">
                  لم يتم العثور على عملاء
                </motion.p>
              ) : (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-gray-400 py-6">
                  ابدأ البحث...
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        isOpen={showReceipt}
        onClose={() => {
          setShowReceipt(false)
          setCompletedTransaction(null)
        }}
        title="🧾 الإيصال الضريبي"
        size="md"
      >
        {completedTransaction && (
          <div className="space-y-4">
            {/* Paper size selector */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-gray-400">حجم الورق:</span>
              <div className="inline-flex rounded-lg border border-white/20 overflow-hidden">
                {(['80mm', '58mm'] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      setPaperWidth(w)
                      localStorage.setItem('receiptPaperWidth', w)
                    }}
                    className={`px-4 py-1.5 text-sm font-bold transition ${
                      paperWidth === w ? 'bg-pink-500 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Receipt Preview */}
            <div className="bg-white text-black p-6 rounded-lg shadow-xl overflow-auto max-h-96" style={{ fontFamily: "'Cairo', Arial, sans-serif", direction: 'rtl' }}>
              <ReceiptTemplate
                ref={receiptRef}
                transactionId={completedTransaction.transactionId}
                client_name={completedTransaction.client_name}
                client_phone={completedTransaction.client_phone}
                barber_name={completedTransaction.barber_name}
                date={completedTransaction.date}
                time={completedTransaction.time}
                items={completedTransaction.items}
                subtotal={completedTransaction.subtotal}
                discount={completedTransaction.discount}
                discount_type={completedTransaction.discount_type}
                total={completedTransaction.total}
                payment_method={completedTransaction.payment_method}
                paperWidth={paperWidth}
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <motion.button
                onClick={handlePrint}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-blue-500/40 transition"
              >
                <Printer size={20} />
                <span>طباعة الإيصال</span>
              </motion.button>

              <motion.button
                onClick={() => {
                  setShowReceipt(false)
                  setCompletedTransaction(null)
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-pink-500 to-pink-600 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-pink-500/40 transition"
              >
                <Check size={20} />
                <span>معاملة جديدة</span>
              </motion.button>
            </div>

            {/* Info Text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center text-sm text-blue-900">
              <p>
                تم حفظ الإيصال بنجاح في السجلات
                {completedTransaction.invoiceNo ? ` - رقم الفاتورة INV-${String(completedTransaction.invoiceNo).padStart(6, '0')}` : ''}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Print-only receipt (portaled to <body>, hidden on screen, shown on print). */}
      {completedTransaction &&
        createPortal(
          <div id="print-area" data-paper={paperWidth}>
            <ReceiptTemplate
              transactionId={completedTransaction.transactionId}
              client_name={completedTransaction.client_name}
              client_phone={completedTransaction.client_phone}
              barber_name={completedTransaction.barber_name}
              date={completedTransaction.date}
              time={completedTransaction.time}
              items={completedTransaction.items}
              subtotal={completedTransaction.subtotal}
              discount={completedTransaction.discount}
              discount_type={completedTransaction.discount_type}
              total={completedTransaction.total}
              payment_method={completedTransaction.payment_method}
              paperWidth={paperWidth}
            />
          </div>,
          document.body
        )}
    </div>
  )
}