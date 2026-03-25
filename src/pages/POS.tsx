import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Modal } from '../components/ui/Modal'
import { ReceiptTemplate } from '../components/receipt/ReceiptTemplate'
import { X, Search, Trash2, Printer, Check } from 'lucide-react'
import { useClients } from '../db/hooks/useClients'
import { useServices } from '../db/hooks/useServices'
import { useTransactions } from '../db/hooks/useTransactions'
import { useVisitLogs } from '../db/hooks/useVisitLogs'
import { useServiceVariants } from '../db/hooks/useServiceVariants'
import { useBarbers } from '../db/hooks/useBarbers'
import { useBookings } from '../db/hooks/useBookings'
import { checkSubscriptionStatus } from '../utils/subscriptionChecker'
import { appEmitter } from '../utils/eventEmitter'
import { getEgyptDateString, getEgyptTimeString } from '../utils/egyptTime'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'

// ✅ Normalize search input - fix Arabic keyboard/IME issues
const normalizeSearchInput = (value: string): string => {
  if (!value) return ''
  
  // Map Arabic numerals to English
  const arabicToEnglish: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  }
  
  let normalized = value
  
  // Convert Arabic numerals to English
  for (const [arabic, english] of Object.entries(arabicToEnglish)) {
    normalized = normalized.replace(new RegExp(arabic, 'g'), english)
  }
  
  // Remove any control characters or encoding issues
  // Keep only letters, numbers, and common symbols (+ - space)
  normalized = normalized.replace(/[^\u0621-\u064Ea-zA-Z0-9\s\-+]/g, '')
  
  return normalized.trim()
}

interface CartItem {
  id: string
  name: string
  price: number
}

interface CompletedTransaction {
  transactionId: string
  client_name: string
  client_phone: string
  barber_name?: string
  barberPhone?: string
  date: string
  time: string
  items: CartItem[]
  subtotal: number
  discount: number
  discount_type: 'percentage' | 'fixed'
  total: number
  payment_method: string
}

export const POS: React.FC = () => {
  const { clients, updateClient } = useClients()
  const { services } = useServices()
  const { addTransaction } = useTransactions()
  const { addVisitLog } = useVisitLogs()
  const { getVariantsByServiceId } = useServiceVariants()
  const { barbers } = useBarbers()
  const { getTodayBookings, updateBooking } = useBookings()
  const { clinicId } = useAuth()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [discount_type, setdiscount_type] = useState<'percentage' | 'fixed'>('fixed')
  const [allVariants, setAllVariants] = useState<{[key: string]: any[]}>({})
  const [payment_method, setpayment_method] = useState('cash')
  const [showClientSearch, setShowClientSearch] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [completedTransaction, setCompletedTransaction] = useState<CompletedTransaction | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [selectedBarber, setSelectedBarber] = useState<any>(null)
  const receiptRef = useRef<HTMLDivElement>(null)

  // Load variants
  useEffect(() => {
    const loadAllVariants = async () => {
      const variants: {[key: string]: any[]} = {}
      for (const service of services) {
        if (!service.id) continue
        try {
          const serviceVariants = await getVariantsByServiceId(service.id)
          if (serviceVariants && serviceVariants.length > 0) {
            variants[service.id] = serviceVariants
          }
        } catch (err) {
          // No variants
        }
      }
      setAllVariants(variants)
    }

    if (services.length > 0) {
      loadAllVariants()
    }
  }, [services, getVariantsByServiceId])

  // ✅ Simple, accurate search logic
  // Phone search is EXACT substring match
  // Name search can include partial matches
  const searchResults = (() => {
    const normalized = normalizeSearchInput(searchQuery)
    if (!normalized) return []
    
    const q = normalized.trim().toLowerCase()
    const isNumeric = /^\d+$/.test(q)  // All digits = phone search only
    
    const filtered = clients.filter(client => {
      if (isNumeric) {
        // ✅ Phone search: exact substring match only
        return client.phone?.toLowerCase().includes(q) || false
      }
      // ✅ Name/mixed search: fuzzy by name, exact by phone
      return (
        client.name?.toLowerCase().includes(q) ||
        client.phone?.toLowerCase().includes(q)
      )
    })
    
    // Convert to Fuse result format for consistency with UI
    return filtered.map(item => ({ item, score: 0 } as any))
  })()

  const handleAddService = async (service: any) => {
    const variants = allVariants[service.id]

    if (variants && variants.length > 0) {
      // Show variant picker
      const variantPrice = variants[0].price
      addToCart(service.nameAr, variantPrice)
    } else {
      // Add with default price
      addToCart(service.nameAr, service.price)
    }
  }

  const handleAddVariant = (service: any, variant: any) => {
    addToCart(`${service.nameAr} - ${variant.nameAr}`, variant.price)
  }

  const addToCart = (name: string, price: number) => {
    setCart([...cart, { id: Math.random().toString(), name, price }])
    toast.success('✅ تم اضافة الخدمة')
  }

  const removeFromCart = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx))
    toast.success('تم الحذف')
  }

  const calculateSubtotal = () => cart.reduce((sum, item) => sum + item.price, 0)
  const calculateDiscount = () =>
    discount_type === 'percentage'
      ? (calculateSubtotal() * discount) / 100
      : discount

  const subtotal = calculateSubtotal()
  const discountAmount = calculateDiscount()
  const total = subtotal - discountAmount

  const handleCompleteSale = async () => {
    if (!selectedClient) {
      toast.error('اختر العميل أولاً')
      return
    }

    if (cart.length === 0) {
      toast.error('السلة فارغة')
      return
    }

    // Check subscription status before allowing transaction
    try {
      const subStatus = await checkSubscriptionStatus(clinicId || '')
      if (!subStatus.isActive) {
        const messages: Record<string, string> = {
          'inactive': 'اشتراكك غير نشط. يرجى تفعيل الاشتراك',
          'suspended': 'تم إيقاف اشتراكك. يرجى التواصل مع الدعم',
          'expired': 'انتهى صلاحية اشتراكك. يرجى تجديد الاشتراك',
        }
        toast.error(messages[subStatus.status] || 'اشتراكك غير صالح')
        return
      }
    } catch (err) {
      console.error('Error checking subscription:', err)
      toast.error('فشل التحقق من صلاحية الاشتراك')
      return
    }

    try {
      setIsCheckingOut(true)
      const dateStr = getEgyptDateString()
      const timeStr = getEgyptTimeString()

      // Create transaction
      const newTransaction = await addTransaction({
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        client_phone: selectedClient.phone,
        visit_number: (selectedClient.total_visits || 0) + 1,
        date: dateStr,
        time: timeStr,
        items: cart,
        subtotal,
        discount: discountAmount,
        discount_type,
        total,
        payment_method: payment_method as 'cash' | 'card' | 'wallet',
        barber_id: selectedBarber?.id || undefined,
      })

      const transactionId = newTransaction?.id || 'unknown'

      // Update client
      await updateClient(selectedClient.id, {
        total_visits: (selectedClient.total_visits || 0) + 1,
        total_spent: (selectedClient.total_spent || 0) + total,
        last_visit: dateStr,
      })

      // Create visit log
      await addVisitLog({
        client_id: selectedClient.id,
        client_name: selectedClient.name,
        visitDate: dateStr,
        visitTime: timeStr,
        servicesCount: cart.length,
        total_spent: total,
        notes: `${cart.length} services - ${payment_method}`,
      })

      // Auto-complete bookings: Update today's pending/ongoing bookings for this client to "completed"
      try {
        const todayBookings = getTodayBookings()
        const clientBookingsToday = todayBookings.filter((b: any) => 
          b.client_id === selectedClient.id && 
          (b.status === 'pending' || b.status === 'ongoing')
        )

        // Update each booking to completed
        for (const booking of clientBookingsToday) {
          if (booking.id) {
            await updateBooking(booking.id, { status: 'completed' })
          }
        }

        if (clientBookingsToday.length > 0) {
          console.log(`✅ تم تحديث ${clientBookingsToday.length} حجز إلى مكتمل`)
        }
      } catch (bookingErr) {
        console.error('Error updating bookings:', bookingErr)
        // Don't fail the transaction if booking update fails
      }

      // Show receipt
      setCompletedTransaction({
        transactionId,
        client_name: selectedClient.name,
        client_phone: selectedClient.phone,
        barber_name: selectedBarber?.name || '',
        barberPhone: selectedBarber?.phone || '',
        date: dateStr,
        time: timeStr,
        items: cart,
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
      appEmitter.emit('transaction:created', { total, date: dateStr })
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '', 'height=600,width=400,top=100,left=100')
      if (printWindow) {
        const receiptHTML = receiptRef.current.outerHTML
        const printContent = `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>الإيصال</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
            <style>
              * { 
                margin: 0; 
                padding: 0; 
                box-sizing: border-box; 
              }
              html, body { 
                width: 80mm;
                margin: 0;
                padding: 0;
              }
              body { 
                font-family: 'Cairo', 'Arial', monospace;
                font-size: 12px;
                line-height: 1.6;
                direction: rtl;
                text-align: right;
                background: white;
                color: black;
              }
              #receipt-container {
                width: 80mm;
                padding: 0;
                margin: 0;
                background: white;
                font-family: 'Cairo', 'Arial', monospace;
              }
              @media print {
                body > *:not(#receipt-container) { display: none !important; }
                #receipt-container { 
                  width: 80mm;
                  font-family: 'Cairo', 'Arial', monospace;
                  direction: rtl;
                  margin: 0;
                  padding: 10px;
                }
              }
            </style>
          </head>
          <body>
            ${receiptHTML}
            <script>
              window.print();
            </script>
          </body>
          </html>
        `
        printWindow.document.open()
        printWindow.document.write(printContent)
        printWindow.document.close()
      }
    }
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden flex flex-col">
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
          <p className="text-3xl md:text-4xl font-bold text-gold-400">
            {total.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400">ج.م</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-0 md:gap-4 p-0 md:p-4">
        {/* Left: Services - Full width on mobile, 2/3 on desktop */}
        <div className="flex-1 flex flex-col overflow-hidden md:rounded-lg md:border md:border-white/10 md:bg-white/5">
          {/* Client Selection Bar */}
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-white/10 flex-shrink-0">
            {selectedClient ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-3 bg-gradient-to-r from-gold-400/10 to-yellow-500/10 border border-gold-400/30 rounded-lg"
              >
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
              </motion.div>
            ) : (
              <motion.button
                onClick={() => setShowClientSearch(true)}
                whileHover={{ scale: 1.01 }}
                className="w-full p-4 border-2 border-dashed border-gold-400/40 hover:border-gold-400 rounded-lg transition flex items-center justify-center gap-2 text-gold-400 font-bold text-center"
              >
                <Search size={20} />
                <span>اختر عميل</span>
              </motion.button>
            )}
          </div>

          {/* Services Grid */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
            <h2 className="text-lg font-bold text-white sticky top-0 bg-gradient-to-b from-black to-transparent">
              📋 الخدمات
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              <AnimatePresence mode="popLayout">
                {services.map((service) => {
                  const variants = (service.id && allVariants[service.id]) || []

                  return (
                    <motion.div
                      key={service.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                      className="group"
                    >
                      {variants.length > 0 ? (
                        // Show first variant as main button, others nested
                        <div className="space-y-1.5">
                          <motion.button
                            onClick={() => handleAddVariant(service, variants[0])}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-full p-3 bg-gradient-to-br from-white/15 to-white/5 hover:from-gold-400/20 hover:to-yellow-500/15 border border-white/20 hover:border-gold-400/40 rounded-lg transition shadow-lg"
                          >
                            <p className="text-white font-bold text-xs md:text-sm line-clamp-2">
                              {service.nameAr}
                            </p>
                            <p className="text-gold-400 font-bold text-sm mt-1">
                              {variants[0].price} ج.م
                            </p>
                          </motion.button>

                          {/* Show other variants */}
                          {variants.length > 1 && (
                            <div className="space-y-1">
                              {variants.slice(1, 3).map((variant: any) => (
                                <motion.button
                                  key={variant.id}
                                  onClick={() => handleAddVariant(service, variant)}
                                  whileHover={{ scale: 1.05, x: 2 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold-400/30 rounded text-left transition text-xs"
                                >
                                  <p className="text-gray-300 truncate">{variant.nameAr}</p>
                                  <p className="text-gold-400 font-bold text-xs">
                                    {variant.price} ج.م
                                  </p>
                                </motion.button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        // Show default service
                        <motion.button
                          onClick={() => handleAddService(service)}
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-full p-3 bg-gradient-to-br from-white/15 to-white/5 hover:from-gold-400/20 hover:to-yellow-500/15 border border-white/20 hover:border-gold-400/40 rounded-lg transition shadow-lg space-y-1"
                        >
                          <p className="text-white font-bold text-xs md:text-sm line-clamp-2">
                            {service.nameAr}
                          </p>
                          <p className="text-gold-400 font-bold text-sm">
                            {service.price} ج.م
                          </p>
                        </motion.button>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right: Cart & Checkout - Full width on mobile below services, sidebar on desktop */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full md:w-96 flex flex-col bg-gradient-to-br from-white/10 to-white/5 border-t md:border-t-0 md:border border-white/10 rounded-t-2xl md:rounded-lg p-4 md:p-6 space-y-4 overflow-hidden"
        >
          {/* Cart Header */}
          <div className="flex items-center justify-between sticky top-0 bg-gradient-to-b from-black to-transparent -mx-4 md:-mx-6 px-4 md:px-6 py-2">
            <h2 className="text-lg md:text-xl font-bold text-white">🛒 السلة</h2>
            <span className="text-sm font-semibold bg-gold-400/20 text-gold-400 px-3 py-1 rounded-full">
              {cart.length} عنصر
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
                cart.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                      <p className="text-gold-400 font-bold text-sm">{item.price} ج.م</p>
                    </div>
                    <motion.button
                      onClick={() => removeFromCart(idx)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition flex-shrink-0"
                    >
                      <Trash2 size={18} />
                    </motion.button>
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
              className="space-y-3 border-t border-white/10 pt-4 sticky bottom-0 bg-gradient-to-t from-black to-transparent -mx-4 md:-mx-6 px-4 md:px-6 py-4"
            >
              {/* Subtotal */}
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
                  placeholder="0"
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
                <span className="text-2xl font-bold text-gold-400">{total.toFixed(2)}</span>
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

              {/* Staff Selection */}
              <select
                value={selectedBarber?.id || ''}
                onChange={(e) => {
                  const barber = barbers.find(b => b.id === e.target.value)
                  setSelectedBarber(barber || null)
                }}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
              >
                <option value="">اختر الموظف (اختياري)</option>
                {barbers.filter(b => b.active).map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    ✂️ {barber.name}
                  </option>
                ))}
              </select>

              {/* Checkout Button - Large and Prominent */}
              <motion.button
                onClick={handleCompleteSale}
                disabled={isCheckingOut || !selectedClient || cart.length === 0}
                whileHover={!isCheckingOut && selectedClient ? { scale: 1.02, y: -2 } : {}}
                whileTap={!isCheckingOut && selectedClient ? { scale: 0.98 } : {}}
                className="w-full p-4 bg-gradient-to-r from-gold-400 to-yellow-400 text-black font-bold text-base md:text-lg rounded-xl hover:shadow-2xl hover:shadow-gold-400/40 disabled:opacity-50 disabled:cursor-not-allowed transition transform"
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
                // ✅ Use currentTarget to get the actual DOM element value
                const inputValue = e.currentTarget.value
                // ✅ Normalize the input to handle keyboard/IME issues
                const normalizedValue = normalizeSearchInput(inputValue)
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
                    className="w-full p-4 bg-white/5 hover:bg-gold-400/10 border border-white/10 hover:border-gold-400/30 rounded-lg text-left transition"
                  >
                    <p className="text-white font-semibold">{item.name}</p>
                    <p className="text-xs text-gray-400">📞 {item.phone}</p>
                    <p className="text-xs text-gold-400 mt-1">
                      {item.total_visits} زيارات • {item.total_spent?.toFixed(2)} ج.م
                    </p>
                  </motion.button>
                ))
              ) : searchQuery ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-gray-400 py-6"
                >
                  لم يتم العثور على عملاء
                </motion.p>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-gray-400 py-6"
                >
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
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Print Button - Large and Primary */}
              <motion.button
                onClick={handlePrint}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-blue-500/40 transition"
              >
                <Printer size={20} />
                <span>طباعة الإيصال</span>
              </motion.button>

              {/* New Transaction Button */}
              <motion.button
                onClick={() => {
                  setShowReceipt(false)
                  setCompletedTransaction(null)
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-gold-400 to-yellow-400 text-black font-bold rounded-lg hover:shadow-lg hover:shadow-gold-400/40 transition"
              >
                <Check size={20} />
                <span>معاملة جديدة</span>
              </motion.button>
            </div>

            {/* Info Text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center text-sm text-blue-900">
              <p>تم حفظ الإيصال بنجاح في السجلات</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
