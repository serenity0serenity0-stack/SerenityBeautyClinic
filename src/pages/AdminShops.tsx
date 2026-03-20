import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/db/supabase'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { Trash2, Edit2, Plus, Calendar } from 'lucide-react'

interface Plan {
  id: string
  name: string
  pricing_type: 'per_transaction' | 'per_service' | 'quota'
  price_per_unit: number | null
  quota_limit: number | null
  monthly_price: number | null
}

interface ShopWithPlan {
  id: string
  name: string
  owner_email: string
  subscription_status: 'active' | 'inactive' | 'suspended'
  subscription_end_date: string | null
  plan_id: string | null
  plans: Plan | null
}

export const AdminShops = () => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'

  // State management
  const [shops, setShops] = useState<ShopWithPlan[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedShop, setSelectedShop] = useState<ShopWithPlan | null>(null)
  const [creatingShop, setCreatingShop] = useState(false)
  const [extendingSubscription, setExtendingSubscription] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    owner_email: '',
    password: '',
    plan_id: '',
    subscription_end_date: '',
  })

  const [extendData, setExtendData] = useState({
    days: '30',
  })

  // Fetch shops and plans
  useEffect(() => {
    fetchShopsAndPlans()
  }, [])

  const fetchShopsAndPlans = async () => {
    try {
      setLoading(true)

      // Fetch shops
      const { data: shopsData, error: shopsError } = await supabase
        .from('shops')
        .select(`
          id,
          name,
          owner_email,
          subscription_status,
          subscription_end_date,
          plan_id,
          plans (
            id,
            name,
            pricing_type,
            price_per_unit,
            quota_limit,
            monthly_price
          )
        `)
        .order('created_at', { ascending: false })

      if (shopsError) throw shopsError

      // Fetch plans
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .order('created_at', { ascending: true })

      if (plansError) throw plansError

      setShops((shopsData as unknown as ShopWithPlan[]) || [])
      setPlans((plansData as Plan[]) || [])
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error(t('admin.shops.error_fetch'))
    } finally {
      setLoading(false)
    }
  }

  // Create shop
  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.owner_email || !formData.password || !formData.subscription_end_date) {
      toast.error(t('errors.required_field'))
      return
    }

    try {
      setCreatingShop(true)

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.owner_email,
        password: formData.password,
        options: {
          data: {
            role: 'shop_owner',
          },
        },
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
          toast.error(t('admin.shops.error_email_exists'))
        } else {
          throw authError
        }
        return
      }

      // Create shop
      const { error: shopError } = await supabase.from('shops').insert([
        {
          name: formData.name,
          owner_email: formData.owner_email,
          plan_id: formData.plan_id || null,
          subscription_end_date: formData.subscription_end_date,
          subscription_status: 'active',
          user_id: authData.user?.id,
        },
      ])

      if (shopError) throw shopError

      toast.success(t('admin.shops.shop_created'))
      setFormData({ name: '', owner_email: '', password: '', plan_id: '', subscription_end_date: '' })
      setShowCreateModal(false)
      await fetchShopsAndPlans()
    } catch (error: any) {
      console.error('Error creating shop:', error)
      toast.error(t('admin.shops.error_create'))
    } finally {
      setCreatingShop(false)
    }
  }

  // Extend subscription
  const handleExtendSubscription = async () => {
    if (!selectedShop) return

    try {
      setExtendingSubscription(true)

      const currentEnd = new Date(selectedShop.subscription_end_date || new Date())
      const newEnd = new Date(currentEnd.getTime() + parseInt(extendData.days) * 24 * 60 * 60 * 1000)

      const { error } = await supabase
        .from('shops')
        .update({ subscription_end_date: newEnd.toISOString().split('T')[0] })
        .eq('id', selectedShop.id)

      if (error) throw error

      toast.success(t('admin.shops.subscription_extended'))
      setShowExtendModal(false)
      setExtendData({ days: '30' })
      await fetchShopsAndPlans()
    } catch (error: any) {
      console.error('Error extending subscription:', error)
      toast.error(t('admin.shops.error_update'))
    } finally {
      setExtendingSubscription(false)
    }
  }

  // Toggle status
  const handleToggleStatus = async (shop: ShopWithPlan) => {
    try {
      const newStatus = shop.subscription_status === 'active' ? 'inactive' : 'active'

      const { error } = await supabase
        .from('shops')
        .update({ subscription_status: newStatus })
        .eq('id', shop.id)

      if (error) throw error

      toast.success(t('admin.shops.shop_updated'))
      await fetchShopsAndPlans()
    } catch (error: any) {
      console.error('Error updating shop:', error)
      toast.error(t('admin.shops.error_update'))
    }
  }

  // Delete shop
  const handleDeleteShop = async () => {
    if (!selectedShop) return

    try {
      const { error } = await supabase.from('shops').delete().eq('id', selectedShop.id)

      if (error) throw error

      toast.success(t('admin.shops.shop_deleted'))
      setShowDeleteConfirm(false)
      setSelectedShop(null)
      await fetchShopsAndPlans()
    } catch (error: any) {
      console.error('Error deleting shop:', error)
      toast.error(t('admin.shops.error_delete'))
    }
  }

  // Status color
  const statusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      case 'suspended':
        return 'bg-red-500/20 text-red-400 border border-red-500/30'
      default:
        return 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
    }
  }

  const getPricingTypeLabel = (type: string) => {
    switch (type) {
      case 'per_transaction':
        return t('admin.shops.per_transaction')
      case 'per_service':
        return t('admin.shops.per_service')
      case 'quota':
        return t('admin.shops.quota')
      default:
        return type
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-96'>
        <div className='animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-gold-400'></div>
      </div>
    )
  }

  return (
    <div className='space-y-6 pb-8'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-white mb-2'>{t('admin.shops.title')}</h1>
          <p className='text-slate-400'>{t('admin.shops.description')}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className='px-6 py-3 bg-gradient-to-r from-gold-400 to-gold-500 text-slate-900 font-semibold rounded-lg hover:shadow-lg hover:shadow-gold-400/30 transition flex items-center gap-2'
        >
          <Plus size={20} />
          {t('admin.shops.create_new_shop')}
        </button>
      </div>

      {/* Shops Table */}
      <div className='glass rounded-xl overflow-hidden border border-white/10'>
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr className='border-b border-white/10 bg-white/5'>
                <th className='px-6 py-4 text-left text-sm font-semibold text-slate-200'>{t('common.name')}</th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-slate-200'>{t('admin.shops.owner_email')}</th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-slate-200'>{t('admin.shops.plan')}</th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-slate-200'>{t('admin.shops.subscription_status')}</th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-slate-200'>{t('admin.shops.end_date')}</th>
                <th className='px-6 py-4 text-left text-sm font-semibold text-slate-200'>{t('admin.shops.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {shops.length === 0 ? (
                <tr>
                  <td colSpan={6} className='px-6 py-12 text-center'>
                    <p className='text-slate-400'>{t('admin.shops.no_shops')}</p>
                  </td>
                </tr>
              ) : (
                shops.map(shop => (
                  <tr key={shop.id} className='border-b border-white/5 hover:bg-white/5 transition'>
                    <td className='px-6 py-4 text-white font-medium'>{shop.name}</td>
                    <td className='px-6 py-4 text-slate-300 text-sm'>{shop.owner_email}</td>
                    <td className='px-6 py-4 text-slate-300 text-sm'>{shop.plans?.name || '—'}</td>
                    <td className='px-6 py-4'>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold transition ${statusColor(shop.subscription_status)}`}>
                        {t(`admin.shops.${shop.subscription_status}`)}
                      </span>
                    </td>
                    <td className='px-6 py-4 text-slate-300 text-sm'>
                      {shop.subscription_end_date
                        ? new Date(shop.subscription_end_date).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')
                        : '—'}
                    </td>
                    <td className='px-6 py-4'>
                      <div className='flex gap-2'>
                        <button
                          onClick={() => {
                            setSelectedShop(shop)
                            setShowExtendModal(true)
                          }}
                          className='p-2 hover:bg-white/10 rounded transition text-slate-400 hover:text-gold-400'
                          title={t('admin.shops.extend_subscription')}
                        >
                          <Calendar size={18} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(shop)}
                          className={`p-2 rounded transition ${
                            shop.subscription_status === 'active'
                              ? 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
                              : 'text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400'
                          }`}
                          title={shop.subscription_status === 'active' ? t('admin.shops.deactivate') : t('admin.shops.activate')}
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedShop(shop)
                            setShowDeleteConfirm(true)
                          }}
                          className='p-2 hover:bg-red-500/20 rounded transition text-slate-400 hover:text-red-400'
                          title={t('admin.shops.delete_shop')}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE SHOP MODAL */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('admin.shops.create_new_shop')}
        size='lg'
      >
        <form onSubmit={handleCreateShop} className='space-y-4'>
          {/* Shop Name */}
          <div>
            <label className='block text-sm font-medium text-slate-200 mb-2'>{t('admin.shops.shop_name')} *</label>
            <input
              type='text'
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('admin.shops.shop_name')}
              className='w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-gold-400/50 transition'
              required
            />
          </div>

          {/* Owner Email */}
          <div>
            <label className='block text-sm font-medium text-slate-200 mb-2'>{t('admin.shops.owner_email')} *</label>
            <input
              type='email'
              value={formData.owner_email}
              onChange={e => setFormData({ ...formData, owner_email: e.target.value })}
              placeholder={t('common.email')}
              className='w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-gold-400/50 transition'
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className='block text-sm font-medium text-slate-200 mb-2'>{t('admin.shops.password')} *</label>
            <input
              type='password'
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              placeholder={t('common.password')}
              className='w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-gold-400/50 transition'
              required
            />
          </div>

          {/* Plan Selection */}
          <div>
            <label className='block text-sm font-medium text-slate-200 mb-2'>{t('admin.shops.select_plan')}</label>
            <select
              value={formData.plan_id}
              onChange={e => setFormData({ ...formData, plan_id: e.target.value })}
              className='w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold-400/50 transition'
            >
              <option value=''>{t('admin.shops.select_plan')}</option>
              {plans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {getPricingTypeLabel(plan.pricing_type)}
                </option>
              ))}
            </select>
          </div>

          {/* Subscription End Date */}
          <div>
            <label className='block text-sm font-medium text-slate-200 mb-2'>{t('admin.shops.subscription_end_date')} *</label>
            <input
              type='date'
              value={formData.subscription_end_date}
              onChange={e => setFormData({ ...formData, subscription_end_date: e.target.value })}
              className='w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold-400/50 transition'
              required
            />
          </div>

          {/* Buttons */}
          <div className='flex gap-3 justify-end pt-4'>
            <button
              type='button'
              onClick={() => setShowCreateModal(false)}
              className='px-4 py-2 border border-white/20 text-slate-300 rounded-lg hover:bg-white/5 transition'
            >
              {t('common.cancel')}
            </button>
            <button
              type='submit'
              disabled={creatingShop}
              className='px-6 py-2 bg-gradient-to-r from-gold-400 to-gold-500 text-slate-900 font-semibold rounded-lg hover:shadow-lg hover:shadow-gold-400/30 transition disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {creatingShop ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* EXTEND SUBSCRIPTION MODAL */}
      <Modal
        isOpen={showExtendModal}
        onClose={() => setShowExtendModal(false)}
        title={t('admin.shops.extend_subscription')}
        size='sm'
      >
        <div className='space-y-4'>
          {selectedShop && (
            <>
              <div>
                <p className='text-slate-300 mb-2'>{selectedShop.name}</p>
                <div className='bg-white/5 border border-white/10 rounded-lg p-3'>
                  <p className='text-xs text-slate-400'>{t('admin.shops.end_date')}</p>
                  <p className='text-white font-semibold'>
                    {selectedShop.subscription_end_date
                      ? new Date(selectedShop.subscription_end_date).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')
                      : '—'}
                  </p>
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-slate-200 mb-2'>{t('admin.shops.extend_days')} *</label>
                <input
                  type='number'
                  value={extendData.days}
                  onChange={e => setExtendData({ days: e.target.value })}
                  min='1'
                  className='w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-gold-400/50 transition'
                />
              </div>

              <div className='bg-white/5 border border-white/10 rounded-lg p-3'>
                <p className='text-xs text-slate-400'>{t('admin.shops.end_date')}</p>
                <p className='text-white font-semibold'>
                  {new Date(
                    new Date(selectedShop.subscription_end_date || new Date()).getTime() +
                      parseInt(extendData.days) * 24 * 60 * 60 * 1000
                  ).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')}
                </p>
              </div>
            </>
          )}

          <div className='flex gap-3 justify-end pt-4'>
            <button
              onClick={() => setShowExtendModal(false)}
              className='px-4 py-2 border border-white/20 text-slate-300 rounded-lg hover:bg-white/5 transition'
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleExtendSubscription}
              disabled={extendingSubscription}
              className='px-6 py-2 bg-gradient-to-r from-gold-400 to-gold-500 text-slate-900 font-semibold rounded-lg hover:shadow-lg hover:shadow-gold-400/30 transition disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {extendingSubscription ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setSelectedShop(null)
        }}
        onConfirm={handleDeleteShop}
        title={t('admin.shops.delete_shop')}
        message={t('admin.shops.delete_confirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        isDangerous={true}
      />
    </div>
  )
}
