import { useEffect, useState } from 'react'
import { supabase } from '@/db/supabase'
import toast from 'react-hot-toast'
import { Trash2, Eye } from 'lucide-react'

interface ShopWithPlan {
  id: string
  name: string
  owner_email: string
  subscription_status: 'active' | 'inactive' | 'suspended'
  subscription_end_date: string | null
  plan_id: string
  plans: {
    name: any
    pricing_type: any
  } | null
}

export const AdminShops = () => {
  const [shops, setShops] = useState<ShopWithPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShop, setSelectedShop] = useState<ShopWithPlan | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const fetchShops = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('shops')
          .select(`
            id,
            name,
            owner_email,
            subscription_status,
            subscription_end_date,
            plan_id,
            plans (
              name,
              pricing_type
            )
          `)
          .order('created_at', { ascending: false })

        if (error) throw error
        setShops((data as unknown as ShopWithPlan[]) || [])
      } catch (error: any) {
        console.error('Error fetching shops:', error)
        toast.error('Failed to load shops')
      } finally {
        setLoading(false)
      }
    }

    fetchShops()
  }, [])

  const handleUpdateSubscription = async (shopId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('shops')
        .update({ subscription_status: status })
        .eq('id', shopId)

      if (error) throw error
      toast.success('Subscription updated')
      
      // Refresh shops
      const { data } = await supabase
        .from('shops')
        .select(`
          id,
          name,
          owner_email,
          subscription_status,
          subscription_end_date,
          plan_id,
          plans (
            name,
            pricing_type
          )
        `)
        .order('created_at', { ascending: false })
      
      setShops((data as unknown as ShopWithPlan[]) || [])
      setShowModal(false)
    } catch (error: any) {
      toast.error('Failed to update subscription')
    }
  }

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('Are you sure? This will delete all shop data.')) return

    try {
      const { error } = await supabase.from('shops').delete().eq('id', shopId)

      if (error) throw error
      toast.success('Shop deleted')
      
      setShops(shops.filter(s => s.id !== shopId))
      setShowModal(false)
    } catch (error: any) {
      toast.error('Failed to delete shop')
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'suspended':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
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
      <div>
        <h1 className='text-3xl font-bold text-white mb-2'>Manage Shops</h1>
        <p className='text-slate-400'>Manage all barbershop subscriptions and settings</p>
      </div>

      <div className='bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr className='border-b border-slate-700 bg-slate-900/50'>
                <th className='px-6 py-3 text-left text-slate-300 font-semibold'>Shop Name</th>
                <th className='px-6 py-3 text-left text-slate-300 font-semibold'>Owner Email</th>
                <th className='px-6 py-3 text-left text-slate-300 font-semibold'>Plan</th>
                <th className='px-6 py-3 text-left text-slate-300 font-semibold'>Status</th>
                <th className='px-6 py-3 text-left text-slate-300 font-semibold'>End Date</th>
                <th className='px-6 py-3 text-left text-slate-300 font-semibold'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shops.length === 0 ? (
                <tr>
                  <td colSpan={6} className='px-6 py-8 text-center text-slate-400'>
                    No shops found
                  </td>
                </tr>
              ) : (
                shops.map(shop => (
                  <tr key={shop.id} className='border-b border-slate-700 hover:bg-slate-700/20 transition'>
                    <td className='px-6 py-4 text-white font-medium'>{shop.name}</td>
                    <td className='px-6 py-4 text-slate-300 text-sm'>{shop.owner_email}</td>
                    <td className='px-6 py-4 text-slate-300 text-sm'>{shop.plans?.name || 'None'}</td>
                    <td className='px-6 py-4'>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(shop.subscription_status)}`}>
                        {shop.subscription_status}
                      </span>
                    </td>
                    <td className='px-6 py-4 text-slate-300 text-sm'>
                      {shop.subscription_end_date
                        ? new Date(shop.subscription_end_date).toLocaleDateString('ar-EG')
                        : '-'}
                    </td>
                    <td className='px-6 py-4'>
                      <div className='flex gap-2'>
                        <button
                          onClick={() => {
                            setSelectedShop(shop)
                            setShowModal(true)
                          }}
                          className='p-2 hover:bg-slate-700 rounded transition text-slate-300 hover:text-gold-400'
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteShop(shop.id)}
                          className='p-2 hover:bg-red-900/20 rounded transition text-red-400 hover:text-red-300'
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

      {showModal && selectedShop && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-slate-900 border border-slate-700 rounded-lg max-w-sm w-full p-6'>
            <h2 className='text-xl font-bold text-white mb-4'>{selectedShop.name}</h2>
            
            <div className='space-y-3 mb-6'>
              <div>
                <label className='text-slate-400 text-sm'>Owner Email</label>
                <p className='text-white'>{selectedShop.owner_email}</p>
              </div>
              <div>
                <label className='text-slate-400 text-sm'>Current Plan</label>
                <p className='text-white'>{selectedShop.plans?.name || 'None'}</p>
              </div>
              <div>
                <label className='text-slate-400 text-sm'>Subscription Status</label>
                <div className='flex gap-2 mt-2'>
                  {['active', 'suspended', 'inactive'].map(status => (
                    <button
                      key={status}
                      onClick={() => handleUpdateSubscription(selectedShop.id, status)}
                      className={`px-3 py-1 rounded text-sm font-medium transition ${
                        selectedShop.subscription_status === status
                          ? 'bg-gold-400 text-slate-900'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className='flex gap-2'>
              <button
                onClick={() => setShowModal(false)}
                className='flex-1 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition'
              >
                Close
              </button>
              <button
                onClick={() => handleDeleteShop(selectedShop.id)}
                className='flex-1 px-4 py-2 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition'
              >
                Delete Shop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
