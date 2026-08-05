import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/db/supabase'

interface ReceiptItem {
  name: string
  price: number
  quantity?: number
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
  paperWidth?: string
  showDeveloperCredits?: boolean
}

const paymentMethodMap: Record<string, string> = {
  cash: 'نقداً',
  card: 'بطاقة بنكية',
  wallet: 'محفظة إلكترونية',
}

const formatMoney = (amount: number): string =>
  `${amount.toLocaleString('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`

const formatArabicDate = (date: string): string => {
  try {
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${date}T12:00:00`))
  } catch {
    return date
  }
}

const formatArabicTime = (time: string): string => {
  const parts = time.split(':')
  if (parts.length < 2) return time
  let hours = parseInt(parts[0], 10)
  const suffix = hours >= 12 ? 'مساءً' : 'صباحاً'
  hours = hours % 12 || 12
  return `${String(hours).padStart(2, '0')}:${parts[1]} ${suffix}`
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
      paperWidth = '80mm',
      showDeveloperCredits = false,
    },
    ref
  ) => {
    const { clinicId } = useAuth()
    const [shopName, setShopName] = useState('Serenity Beauty Clinic')
    const [shopPhone, setShopPhone] = useState('')
    const [shopAddress, setShopAddress] = useState('')
    const [taxNumber, setTaxNumber] = useState('')
    const [shopLogo, setShopLogo] = useState('')

    useEffect(() => {
      if (!clinicId) return
      let cancelled = false

      const fetchClinic = async () => {
        try {
          const [settingsRes, clinicRes] = await Promise.all([
            supabase
              .from('settings')
              .select('key, value')
              .eq('clinic_id', clinicId),
            supabase
              .from('clinic')
              .select('name, phone, email, city, description, logo_url, website')
              .eq('id', clinicId)
              .maybeSingle(),
          ])

          if (cancelled) return

          const settingsMap: Record<string, any> = {}
          ;(settingsRes.data || []).forEach((item: any) => {
            settingsMap[item.key] = item.value
          })

          const clinic = clinicRes.data
          setShopName(settingsMap['clinicName'] || clinic?.name || 'Serenity Beauty Clinic')
          setShopPhone(settingsMap['clinicPhone'] || clinic?.phone || '')
          setShopAddress(settingsMap['clinicAddress'] || clinic?.description || clinic?.city || '')
          setTaxNumber(settingsMap['taxNumber'] || '')
          setShopLogo(settingsMap['clinicLogo'] || clinic?.logo_url || '')
        } catch (err) {
          console.error('Error fetching receipt settings:', err)
        }
      }

      fetchClinic()
      return () => {
        cancelled = true
      }
    }, [clinicId])

    const receiptNumber =
      transactionId && transactionId !== 'unknown'
        ? transactionId.slice(-4).toUpperCase()
        : '0001'

    const discountAmount =
      discount_type === 'percentage'
        ? (subtotal * discount) / 100
        : discount

    const discountLabel =
      discount_type === 'percentage' ? `${discount.toFixed(0)}%` : 'ج.م'

    const divider = { borderBottom: '1px dashed #000', margin: '6px 0' }
    const rowSpace = { display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }

    return (
      <div
        ref={ref}
        id="receipt-container"
        style={{
          width: paperWidth,
          maxWidth: paperWidth,
          margin: '0 auto',
          padding: '8px 6px',
          background: '#ffffff',
          color: '#000000',
          fontFamily: "'Cairo', 'Segoe UI', 'Tahoma', Arial, sans-serif",
          direction: 'rtl',
          textAlign: 'right',
          fontSize: '12px',
          lineHeight: '1.5',
          boxSizing: 'border-box',
        }}
      >
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #receipt-container,
            #receipt-container * { visibility: visible !important; }
            #receipt-container {
              position: absolute !important;
              top: 0;
              left: 0;
              right: 0;
              margin: 0 auto;
              width: ${paperWidth};
              max-width: ${paperWidth};
            }
            @page {
              size: ${paperWidth} auto;
              margin: 5mm 0;
            }
          }
        `}</style>

        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          {shopLogo && (
            <img
              src={shopLogo}
              alt=""
              style={{
                height: '52px',
                maxWidth: '55mm',
                objectFit: 'contain',
                marginBottom: '4px',
              }}
            />
          )}
          <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>{shopName}</div>
          {taxNumber && <div style={{ fontSize: '10px', marginBottom: '2px' }}>الرقم الضريبي: {taxNumber}</div>}
          {shopAddress && <div style={{ fontSize: '10px', marginBottom: '2px' }}>{shopAddress}</div>}
          {shopPhone && <div style={{ fontSize: '11px', fontWeight: '700' }}>{shopPhone}</div>}
        </div>

        <div style={divider} />

        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '2px' }}>إيصال ضريبي مبسط</div>
          <div style={{ fontSize: '10px' }}>رقم الإيصال: #{receiptNumber}</div>
          <div style={{ fontSize: '10px' }}>التاريخ: {formatArabicDate(date)}</div>
          <div style={{ fontSize: '10px' }}>الوقت: {formatArabicTime(time)}</div>
        </div>

        <div style={divider} />

        <div style={{ marginBottom: '6px' }}>
          <div style={rowSpace}>
            <span style={{ fontWeight: '700' }}>{client_name}</span>
            <span style={{ color: '#555555' }}>العميل</span>
          </div>
          {client_phone && (
            <div style={rowSpace}>
              <span>{client_phone}</span>
              <span style={{ color: '#555555' }}>الهاتف</span>
            </div>
          )}
        </div>

        {barber_name && (
          <>
            <div style={divider} />
            <div style={{ ...rowSpace, marginBottom: '6px' }}>
              <span style={{ fontWeight: '700' }}>{barber_name}</span>
              <span style={{ color: '#555555' }}>الطبيب</span>
            </div>
          </>
        )}

        <div style={divider} />

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '6px' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'right', fontWeight: '700', paddingBottom: '3px' }}>الخدمة</th>
              <th style={{ textAlign: 'center', fontWeight: '700', paddingBottom: '3px' }}>الكمية</th>
              <th style={{ textAlign: 'center', fontWeight: '700', paddingBottom: '3px' }}>سعر الوحدة</th>
              <th style={{ textAlign: 'left', fontWeight: '700', paddingBottom: '3px' }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const qty = item.quantity || 1
              return (
                <tr key={idx}>
                  <td style={{ textAlign: 'right', padding: '2px 0' }}>{item.name}</td>
                  <td style={{ textAlign: 'center', padding: '2px 0' }}>{qty}</td>
                  <td style={{ textAlign: 'center', padding: '2px 0' }}>{formatMoney(item.price)}</td>
                  <td style={{ textAlign: 'left', padding: '2px 0', fontWeight: '700' }}>
                    {formatMoney(item.price * qty)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={divider} />

        <div style={{ marginBottom: '6px', fontSize: '10px' }}>
          <div style={rowSpace}>
            <span style={{ color: '#555555' }}>المجموع</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ ...rowSpace, color: '#c41e3a' }}>
              <span style={{ color: '#555555' }}>الخصم ({discountLabel})</span>
              <span>-{formatMoney(discountAmount)}</span>
            </div>
          )}
        </div>

        <div style={{ borderBottom: '2px solid #000', margin: '6px 0' }} />

        <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: '800', margin: '6px 0', padding: '6px 0' }}>
          الإجمالي: {formatMoney(total)}
        </div>

        <div style={divider} />

        <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '8px' }}>
          <span style={{ color: '#555555' }}>طريقة الدفع: </span>
          <span style={{ fontWeight: '700' }}>{paymentMethodMap[payment_method] || payment_method}</span>
        </div>

        <div style={divider} />

        <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: '700', marginBottom: '4px' }}>
          شكراً لكم على ثقتكم 🙏
        </div>
        <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '6px' }}>
          نتطلع لخدمتكم مرة أخرى
        </div>

        <div style={divider} />

        <div style={{ textAlign: 'center', fontSize: '9px', color: '#444444', paddingTop: '4px' }}>
          {shopPhone && <div style={{ marginBottom: '1px' }}>{shopPhone}</div>}
          {shopAddress && <div style={{ marginBottom: '1px' }}>{shopAddress}</div>}
        </div>

        {showDeveloperCredits && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '8px',
              color: '#888888',
              marginTop: '6px',
              paddingTop: '4px',
              borderTop: '1px solid #000',
            }}
          >
            <div style={{ fontWeight: '700', marginBottom: '1px' }}>YousefTech</div>
            <div>01000139417</div>
          </div>
        )}
      </div>
    )
  }
)

ReceiptTemplate.displayName = 'ReceiptTemplate'
