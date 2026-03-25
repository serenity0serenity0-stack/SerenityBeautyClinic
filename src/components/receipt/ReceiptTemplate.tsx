import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/db/supabase'

interface ReceiptItem {
  name: string
  price: number
}

interface ReceiptProps {
  client_name: string
  client_phone?: string
  barber_name?: string
  transactionId: string
  date: string
  time: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  discount_type: 'percentage' | 'fixed'
  total: number
  payment_method: string
}

// Convert numbers to Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) - NO LONGER USED
// Now keeping numbers in English as per requirements
// const toArabicNumerals = (n: number | string): string => {
//   // Return as English numbers instead
//   return String(n)
// }

// Format time with Egypt timezone and AM/PM in Arabic
const formatEgyptTime = (time: string): string => {
  try {
    // Parse time string (HH:MM or HH:MM:SS format)
    const parts = time.split(':')
    if (parts.length >= 2) {
      const hours = parseInt(parts[0])
      const minutes = parts[1]
      // Use مساءا (PM) or صباحا (AM) without diacritics
      const suffix = hours >= 12 ? 'مساءا' : 'صباحا'
      return `${hours}:${minutes} ${suffix}`
    }
    return time
  } catch {
    return time
  }
}

// Map payment methods to Arabic
const payment_methodMap: Record<string, string> = {
  cash: 'نقداً',
  card: 'بطاقة بنكية',
  wallet: 'محفظة إلكترونية',
}

export const ReceiptTemplate = React.forwardRef<HTMLDivElement, ReceiptProps>(
  (
    {
      client_name,
      client_phone,
      barber_name,
      transactionId,
      date,
      time,
      items,
      subtotal,
      discount,
      discount_type,
      total,
      payment_method,
    },
    ref
  ) => {
    const { clinicId } = useAuth()
    const [shopName, setShopName] = useState<string>('عيادة الجمال')
    const [shopPhone, setShopPhone] = useState<string>('')
    const [shopAddress, setShopAddress] = useState<string>('')
    const [shopNumber, setShopNumber] = useState<string>('')
    const [formattedTime, setFormattedTime] = useState<string>('')

    // Fetch clinic settings directly from database
    useEffect(() => {
      if (!clinicId) return

      const fetchShopSettings = async () => {
        try {
          const [settingsResult, clinicResult] = await Promise.all([
            supabase
              .from('settings')
              .select('key, value')
              .eq('clinic_id', clinicId),
            supabase
              .from('clinic')
              .select('clinic_number, location, address, name, phone')
              .eq('id', clinicId)
              .single()
          ])

          // Parse settings
          if (settingsResult.data) {
            const settingsMap: Record<string, any> = {}
            settingsResult.data.forEach((item: any) => {
              settingsMap[item.key] = item.value
            })
            setShopName(settingsMap['clinicName'] || 'اسم العيادة')
            setShopPhone(settingsMap['clinicPhone'] || '')
          }

          // Get clinic data
          if (clinicResult.data) {
            setShopName(clinicResult.data.name || shopName)
            setShopPhone(clinicResult.data.phone || '')
            setShopAddress(clinicResult.data.address || clinicResult.data.location || '')
            setShopNumber(clinicResult.data.clinic_number?.toString() || '')
          }
        } catch (err) {
          console.error('Error fetching receipt settings:', err)
          setShopName('اسم العيادة')
          setShopPhone('')
        }
      }

      fetchShopSettings()
    }, [clinicId])

    // Format time with proper timezone display
    useEffect(() => {
      setFormattedTime(formatEgyptTime(time))
    }, [time])

    // Extract last 4 characters from transaction ID
    const receiptNumber = transactionId.slice(-4).toUpperCase()

    // Calculate actual discount amount for display
    const discountAmount =
      discount_type === 'percentage'
        ? (subtotal * discount) / 100
        : discount

    // Format discount label
    const discountLabel =
      discount_type === 'percentage'
        ? `${discount.toFixed(0)}%`
        : `ج.م`

    return (
      <div
        ref={ref}
        id="receipt-container"
        className="bg-white text-black p-0"
        style={{
          width: '80mm',
          margin: '0 auto',
          fontFamily: "'Cairo', 'Arial', monospace",
          direction: 'rtl',
          textAlign: 'center',
          fontSize: '12px',
          lineHeight: '1.6',
        }}
      >
        <style>{`
          @media print {
            body > *:not(#receipt-container) { display: none !important; }
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 0;
              padding: 10mm;
              background: white;
            }
            #receipt-container { 
              width: 80mm;
              max-width: 80mm;
              font-family: 'Cairo', 'Arial', monospace;
              direction: rtl;
              text-align: center;
              margin: 0 auto;
              padding: 0;
              box-sizing: border-box;
            }
            .receipt-divider { 
              border-bottom: 1px solid #000;
              margin: 8px 0;
              padding: 0;
            }
            @page {
              size: 80mm 200mm;
              margin: 0;
            }
          }
        `}</style>

        {/* Header with Separator */}
        <div style={{ textAlign: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '2px solid #000' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
            💉 {shopName} 💉
          </div>
          {shopNumber && (
            <div style={{ fontSize: '10px', marginBottom: '2px' }}>رقم العيادة: {shopNumber}</div>
          )}
          {shopAddress && (
            <div style={{ fontSize: '10px', marginBottom: '2px' }}>📍 {shopAddress}</div>
          )}
          {shopPhone && (
            <div style={{ fontSize: '11px', marginBottom: '2px' }}>📞 {shopPhone}</div>
          )}
        </div>

        {/* Receipt Title */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>فاتورة ضريبية مبسطة</div>
          <div style={{ fontSize: '10px', marginTop: '2px' }}>
            رقم الفاتورة: #{receiptNumber}
          </div>
        </div>

        {/* Divider */}
        <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

        {/* Date & Time */}
        <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '6px' }}>
          <div>التاريخ: {date}</div>
          <div>الوقت: {formattedTime}</div>
        </div>

        {/* Divider */}
        <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

        {/* Client Info */}
        <div style={{ marginBottom: '6px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>{client_name}</span>
            <span style={{ fontWeight: 'bold' }}>العميل :</span>
          </div>
          {client_phone && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>{client_phone}</span>
              <span style={{ fontWeight: 'bold' }}>الهاتف :</span>
            </div>
          )}
        </div>

        {/* Staff Info */}
        {barber_name && (
          <>
            <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />
            <div style={{ marginBottom: '6px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{barber_name}</span>
                <span style={{ fontWeight: 'bold' }}>الموظف :</span>
              </div>
            </div>
          </>
        )}

        {/* Divider */}
        <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

        {/* Services Header */}
        <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>الخدمات:</div>

        {/* Services Divider */}
        <div style={{ borderBottom: '1px dotted #000', margin: '4px 0' }} />

        {/* Services List */}
        <div style={{ marginBottom: '6px' }}>
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                marginBottom: '2px',
              }}
            >
              <span style={{ fontWeight: 'bold' }}>{item.price.toFixed(2)} ج.م</span>
              <span>{item.name}</span>
            </div>
          ))}
        </div>

        {/* Services Divider */}
        <div style={{ borderBottom: '1px dotted #000', margin: '4px 0' }} />

        {/* Totals */}
        <div style={{ marginBottom: '6px', fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ fontWeight: 'bold' }}>{subtotal.toFixed(2)} ج.م</span>
            <span>المجموع:</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c41e3a', marginBottom: '2px' }}>
              <span style={{ fontWeight: 'bold' }}>-{discountAmount.toFixed(2)} ج.م</span>
              <span>الخصم ({discountLabel}):</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="receipt-divider" style={{ borderBottom: '2px solid #000', margin: '8px 0' }} />

        {/* Grand Total */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '8px',
            padding: '4px 0',
          }}
        >
          💰 الإجمالي: {total.toFixed(2)} ج.م
        </div>

        {/* Divider */}
        <div className="receipt-divider" style={{ borderBottom: '2px solid #000', margin: '8px 0' }} />

        {/* Payment Method */}
        <div style={{ textAlign: 'center', marginBottom: '8px', fontSize: '10px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>طريقة الدفع:</div>
          <div>{payment_methodMap[payment_method] || payment_method}</div>
        </div>

        {/* Divider */}
        <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

        {/* Thank You Message */}
        <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>شكراً لكم على ثقتكم 🙏</div>
          <div>نتطلع لخدمتكم مرة أخرى</div>
        </div>

        {/* Divider */}
        <div className="receipt-divider" style={{ borderBottom: '1px solid #000', margin: '6px 0' }} />

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: '8px', marginTop: '8px', paddingTop: '4px', borderTop: '1px solid #000' }}>
          <div style={{ letterSpacing: '2px', marginBottom: '2px' }}>─────────────────────</div>
          <div style={{ fontWeight: 'bold', marginBottom: '1px' }}>YousefTech</div>
          <div style={{ marginBottom: '2px' }}>01000139417</div>
          <div style={{ marginBottom: '2px' }}>تطوير YousefTech</div>
          <div style={{ letterSpacing: '2px' }}>─────────────────────</div>
        </div>
      </div>
    )
  }
)

ReceiptTemplate.displayName = 'ReceiptTemplate'
