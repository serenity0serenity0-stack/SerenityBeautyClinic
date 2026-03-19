import { useEffect, useState } from 'react'
import { supabase } from '@/db/supabase'
import toast from 'react-hot-toast'
import { Trash2, Edit2, Plus } from 'lucide-react'

interface Plan {
  id: string
  name: string
  pricing_type: 'per_transaction' | 'per_service' | 'quota'
  price_per_unit: number | null
  quota_limit: number | null
  monthly_price: number | null
  is_active: boolean
}

export const AdminPlans = () => {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    pricing_type: 'per_transaction' as 'per_transaction' | 'per_service' | 'quota',
    price_per_unit: '',
    quota_limit: '',
    monthly_price: '',
  })

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('plans')
          .select('*')
          .order('created_at', { ascending: true })

        if (error) throw error
        setPlans(data || [])
      } catch (error: any) {
        console.error('Error fetching plans:', error)
        toast.error('Failed to load plans')
      } finally {
        setLoading(false)
      }
    }

    fetchPlans()
  }, [])

  const handleSavePlan = async () => {
    try {
      if (!formData.name) {
        toast.error('Plan name is required')
        return
      }

      const data = {
        name: formData.name,
        pricing_type: formData.pricing_type,
        price_per_unit: formData.pricing_type !== 'quota' ? parseFloat(formData.price_per_unit) : null,
        quota_limit: formData.pricing_type === 'quota' ? parseInt(formData.quota_limit) : null,
        monthly_price: formData.pricing_type === 'quota' ? parseFloat(formData.monthly_price) : null,
      }

      if (editingPlan) {
        const { error } = await supabase.from('plans').update(data).eq('id', editingPlan.id)

        if (error) throw error
        toast.success('Plan updated')
      } else {
        const { error } = await supabase.from('plans').insert(data)

        if (error) throw error
        toast.success('Plan created')
      }

      // Refresh plans
      const { data: updatedPlans } = await supabase
        .from('plans')
        .select('*')
        .order('created_at', { ascending: true })

      setPlans(updatedPlans || [])
      resetForm()
    } catch (error: any) {
      toast.error('Failed to save plan')
    }
  }

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure? Shops using this plan will have no plan.')) return

    try {
      const { error } = await supabase.from('plans').delete().eq('id', planId)

      if (error) throw error
      toast.success('Plan deleted')
      
      setPlans(plans.filter(p => p.id !== planId))
    } catch (error: any) {
      toast.error('Failed to delete plan')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      pricing_type: 'per_transaction',
      price_per_unit: '',
      quota_limit: '',
      monthly_price: '',
    })
    setEditingPlan(null)
    setShowForm(false)
  }

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      pricing_type: (plan.pricing_type as 'per_transaction' | 'per_service' | 'quota'),
      price_per_unit: plan.price_per_unit?.toString() || '',
      quota_limit: plan.quota_limit?.toString() || '',
      monthly_price: plan.monthly_price?.toString() || '',
    })
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-80'>
        <div className='animate-spin rounded-full h-8 w-8 border-t-2 border-gold-400'></div>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-white mb-2'>Pricing Plans</h1>
          <p className='text-slate-400'>Create and manage subscription plans</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className='bg-gold-400 hover:bg-gold-500 text-slate-900 px-4 py-2 rounded font-semibold flex items-center gap-2 transition'
        >
          <Plus size={20} />
          New Plan
        </button>
      </div>

      {showForm && (
        <div className='bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-4'>
          <h2 className='text-xl font-bold text-white'>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h2>
          
          <div>
            <label className='text-slate-300 text-sm font-medium mb-2 block'>Plan Name</label>
            <input
              type='text'
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className='w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:border-gold-400 outline-none'
              placeholder='e.g., Pay Per Transaction'
            />
          </div>

          <div>
            <label className='text-slate-300 text-sm font-medium mb-2 block'>Pricing Type</label>
            <select
              value={formData.pricing_type}
              onChange={e => setFormData({ ...formData, pricing_type: e.target.value as any })}
              className='w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:border-gold-400 outline-none'
            >
              <option value='per_transaction'>Per Transaction</option>
              <option value='per_service'>Per Service</option>
              <option value='quota'>Quota Plan</option>
            </select>
          </div>

          {formData.pricing_type !== 'quota' && (
            <div>
              <label className='text-slate-300 text-sm font-medium mb-2 block'>Price Per Unit (ج.م)</label>
              <input
                type='number'
                value={formData.price_per_unit}
                onChange={e => setFormData({ ...formData, price_per_unit: e.target.value })}
                className='w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:border-gold-400 outline-none'
                placeholder='0.00'
                step='0.01'
              />
            </div>
          )}

          {formData.pricing_type === 'quota' && (
            <>
              <div>
                <label className='text-slate-300 text-sm font-medium mb-2 block'>Quota Limit (transactions/month)</label>
                <input
                  type='number'
                  value={formData.quota_limit}
                  onChange={e => setFormData({ ...formData, quota_limit: e.target.value })}
                  className='w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:border-gold-400 outline-none'
                  placeholder='100'
                  min='1'
                />
              </div>
              <div>
                <label className='text-slate-300 text-sm font-medium mb-2 block'>Monthly Price (ج.م)</label>
                <input
                  type='number'
                  value={formData.monthly_price}
                  onChange={e => setFormData({ ...formData, monthly_price: e.target.value })}
                  className='w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:border-gold-400 outline-none'
                  placeholder='0.00'
                  step='0.01'
                />
              </div>
            </>
          )}

          <div className='flex gap-2'>
            <button
              onClick={handleSavePlan}
              className='flex-1 bg-gold-400 hover:bg-gold-500 text-slate-900 px-4 py-2 rounded font-semibold transition'
            >
              {editingPlan ? 'Update Plan' : 'Create Plan'}
            </button>
            <button
              onClick={resetForm}
              className='flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-semibold transition'
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
        {plans.map(plan => (
          <div key={plan.id} className='bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-gold-400/30 transition'>
            <div className='flex items-start justify-between mb-4'>
              <div>
                <h3 className='text-lg font-bold text-white'>{plan.name}</h3>
                <p className='text-slate-400 text-sm capitalize mt-1'>{plan.pricing_type.replace('_', ' ')}</p>
              </div>
              <div className='flex gap-2'>
                <button
                  onClick={() => handleEditPlan(plan)}
                  className='p-2 hover:bg-slate-700 rounded transition text-slate-300 hover:text-gold-400'
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDeletePlan(plan.id)}
                  className='p-2 hover:bg-red-900/20 rounded transition text-red-400'
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className='space-y-2'>
              {plan.pricing_type === 'quota' ? (
                <>
                  <div>
                    <p className='text-slate-400 text-xs'>Monthly Price</p>
                    <p className='text-2xl font-bold text-gold-400'>ج.م {plan.monthly_price}</p>
                  </div>
                  <div>
                    <p className='text-slate-400 text-xs'>Quota Limit</p>
                    <p className='text-white font-semibold'>{plan.quota_limit} transactions/month</p>
                  </div>
                </>
              ) : (
                <div>
                  <p className='text-slate-400 text-xs'>Price per unit</p>
                  <p className='text-2xl font-bold text-gold-400'>ج.م {plan.price_per_unit}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
