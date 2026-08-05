import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/db/supabase'
import { GlassCard } from '../components/ui/GlassCard'
import { PAGE_KEYS, DEFAULT_CASHIER_PAGES } from '../lib/permissions'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  UserPlus,
  Eye,
  EyeOff,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
  Users as UsersIcon,
  ShieldCheck,
  UserCog,
} from 'lucide-react'

interface StaffUser {
  id: string
  email: string
  name: string | null
  role: string
  active: boolean
  permissions: string[] | null
  password: string | null
  auth_user_id: string
  created_at?: string
}

const inputClass =
  'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-400/40 focus:ring-1 focus:ring-gold-400/30 transition'

const pageLabel = (key: string, t: (key: string) => string): string => {
  const navKey = `navigation.${key}`
  return t(navKey)
}

export const Settings: React.FC = () => {
  const { t } = useTranslation()
  const { role, user } = useAuth()
  const isAdmin = role === 'admin'

  const [users, setUsers] = useState<StaffUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Add-user form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'cashier'>('cashier')
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_CASHIER_PAGES)
  const [creating, setCreating] = useState(false)

  // Row actions
  const [editingId, setEditingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [visiblePasswordId, setVisiblePasswordId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    const { data, error } = await supabase.rpc('get_staff_users')
    if (!error && Array.isArray(data)) {
      setUsers(data as StaffUser[])
    } else {
      toast.error(t('notifications.error_occurred'))
    }
    setLoadingUsers(false)
  }, [t])

  useEffect(() => {
    if (isAdmin) loadUsers()
  }, [isAdmin, loadUsers])

  const togglePermission = (key: string) => {
    setPermissions(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  }

  const handleCreate = async () => {
    if (!email.trim()) return toast.error(t('settings.email_required'))
    if (password.length < 6) return toast.error(t('settings.password_min'))
    setCreating(true)
    const { error } = await supabase.rpc('create_staff_user', {
      p_email: email.trim(),
      p_password: password,
      p_role: newRole,
      p_name: name.trim() || null,
      p_permissions: newRole === 'admin' ? ['all'] : permissions,
    })
    setCreating(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(t('settings.user_added'))
    setName('')
    setEmail('')
    setPassword('')
    setNewRole('cashier')
    setPermissions(DEFAULT_CASHIER_PAGES)
    loadUsers()
  }

  const handleToggleActive = async (u: StaffUser) => {
    const { error } = await supabase.rpc('update_staff_user', {
      p_user_id: u.auth_user_id,
      p_active: !u.active,
    })
    if (error) return toast.error(error.message)
    toast.success(u.active ? t('settings.user_disabled') : t('settings.user_enabled'))
    loadUsers()
  }

  const handleResetPassword = async (u: StaffUser) => {
    if (newPassword.length < 6) return toast.error(t('settings.password_min'))
    const { error } = await supabase.rpc('reset_staff_password', {
      p_user_id: u.auth_user_id,
      p_new_password: newPassword,
    })
    if (error) return toast.error(error.message)
    toast.success(t('settings.password_reset'))
    setResettingId(null)
    setNewPassword('')
    loadUsers()
  }

  const handleDelete = async (u: StaffUser) => {
    if (!window.confirm(t('settings.confirm_delete_user'))) return
    const { error } = await supabase.rpc('delete_staff_user', { p_user_id: u.auth_user_id })
    if (error) return toast.error(error.message)
    toast.success(t('settings.user_deleted'))
    loadUsers()
  }

  const saveEdit = async (u: StaffUser, editRole: string, editName: string, editPerms: string[]) => {
    const { error } = await supabase.rpc('update_staff_user', {
      p_user_id: u.auth_user_id,
      p_role: editRole,
      p_name: editName,
      p_permissions: editRole === 'admin' ? ['all'] : editPerms,
    })
    if (error) return toast.error(error.message)
    toast.success(t('settings.user_updated'))
    setEditingId(null)
    loadUsers()
  }

  // Minimal page for non-admin users who reach settings
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-bold text-white">{t('settings.title')}</h1>
        </motion.div>
        <GlassCard animated={false} className="cursor-default">
          <p className="text-gray-400 text-center py-8">{t('settings.no_permission')}</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-3xl font-bold text-white">{t('settings.title')}</h1>
      </motion.div>

      {/* User Management */}
      <GlassCard animated={false} className="cursor-default">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-6 h-6 text-gold-400" />
          <h2 className="text-xl font-bold text-white">{t('settings.user_management')}</h2>
        </div>
        <p className="text-gray-400 text-sm mb-6">{t('settings.user_management_desc')}</p>

        {/* Add User Form */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
          <div className="flex items-center gap-2 text-gold-400 font-semibold">
            <UserPlus size={18} />
            <span>{t('settings.add_user')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 text-sm mb-2">{t('settings.user_name')}</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('settings.user_name')}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-2">{t('settings.user_email')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-2">{t('settings.user_password')}</label>
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-2">{t('settings.role')}</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as 'admin' | 'cashier')}
                className={`${inputClass} bg-slate-900`}
              >
                <option value="cashier">{t('settings.role_cashier')}</option>
                <option value="admin">{t('settings.role_admin')}</option>
              </select>
            </div>
          </div>

          {newRole === 'cashier' && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-gray-300 text-sm mb-3 font-medium">{t('settings.permissions')}</p>
              <p className="text-gray-500 text-xs mb-3">{t('settings.permissions_hint')}</p>
              <div className="flex flex-wrap gap-2">
                {PAGE_KEYS.map(key => {
                  const checked = permissions.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePermission(key)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                        checked
                          ? 'bg-gold-400/20 border-gold-400/50 text-gold-400'
                          : 'border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {pageLabel(key, t)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {newRole === 'admin' && (
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <UserCog size={16} className="text-gold-400" />
              {t('settings.admin_full_access')}
            </p>
          )}

          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-hot-pink to-deep-pink text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            <UserPlus size={18} />
            {creating ? t('common.loading') : t('settings.add_user')}
          </button>
        </div>

        {/* Users List */}
        <div className="mt-6">
          <div className="flex items-center gap-2 text-gold-400 font-semibold mb-4">
            <UsersIcon size={18} />
            <span>{t('settings.users_list')}</span>
          </div>

          {loadingUsers ? (
            <p className="text-gray-400 py-4">{t('common.loading')}</p>
          ) : users.length === 0 ? (
            <p className="text-gray-500 py-6 text-center">{t('settings.no_users')}</p>
          ) : (
            <div className="space-y-3">
              {users.map(u => {
                const isSelf = u.auth_user_id === user?.id
                return (
                  <div
                    key={u.id}
                    className={`rounded-xl border p-4 transition ${
                      u.active ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hot-pink to-deep-pink flex items-center justify-center text-white font-bold shrink-0">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate">
                            {u.name || u.email}
                            {isSelf && <span className="text-xs text-gold-400 ms-2">(You)</span>}
                          </p>
                          <p className="text-gray-400 text-xs truncate">{u.email}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                u.role === 'admin'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                              }`}
                            >
                              {u.role === 'admin' ? t('settings.role_admin') : t('settings.role_cashier')}
                            </span>
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                u.active
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                  : 'bg-red-500/20 text-red-300 border border-red-400/30'
                              }`}
                            >
                              {u.active ? t('common.active') : t('common.inactive')}
                            </span>
                            {u.role === 'admin' ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                                {t('settings.admin_full_access')}
                              </span>
                            ) : (
                              (u.permissions || []).map(p => (
                                <span
                                  key={p}
                                  className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10"
                                >
                                  {pageLabel(p, t)}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 sm:justify-end flex-wrap">
                        {/* Password viewer */}
                        <button
                          onClick={() => setVisiblePasswordId(visiblePasswordId === u.id ? null : u.id)}
                          title={t('settings.view_password')}
                          className="p-2 hover:bg-white/10 rounded-lg transition text-gray-300"
                        >
                          {visiblePasswordId === u.id ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>

                        {/* Reset password */}
                        <button
                          onClick={() => {
                            setResettingId(resettingId === u.id ? null : u.id)
                            setNewPassword('')
                          }}
                          title={t('settings.reset_password')}
                          className="p-2 hover:bg-white/10 rounded-lg transition text-gray-300"
                        >
                          <RefreshCw size={18} />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => setEditingId(editingId === u.id ? null : u.id)}
                          title={t('settings.edit_user')}
                          className="p-2 hover:bg-white/10 rounded-lg transition text-gray-300"
                        >
                          <Pencil size={18} />
                        </button>

                        {/* Active toggle */}
                        {!isSelf && (
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`relative w-11 h-6 rounded-full transition ${
                              u.active ? 'bg-emerald-500/60' : 'bg-gray-600/50'
                            }`}
                            title={u.active ? t('common.inactive') : t('common.active')}
                          >
                            <span
                              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                                u.active ? 'end-0.5' : 'start-0.5'
                              }`}
                            />
                          </button>
                        )}

                        {/* Delete */}
                        {!isSelf && (
                          <button
                            onClick={() => handleDelete(u)}
                            title={t('settings.delete_user')}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition text-red-400"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Visible password */}
                    {visiblePasswordId === u.id && (
                      <div className="mt-3 rounded-lg bg-black/20 border border-white/10 px-4 py-2 flex items-center justify-between">
                        <span className="text-gray-300 text-sm">{t('settings.user_password')}:</span>
                        <code className="text-gold-400 font-mono">{u.password || '—'}</code>
                      </div>
                    )}

                    {/* Reset password inline */}
                    {resettingId === u.id && (
                      <div className="mt-3 rounded-lg bg-black/20 border border-white/10 p-3 flex items-center gap-2">
                        <input
                          type="text"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder={t('settings.new_password')}
                          className={inputClass}
                        />
                        <button
                          onClick={() => handleResetPassword(u)}
                          className="p-2.5 rounded-lg bg-gold-400/20 text-gold-400 hover:bg-gold-400/30 transition"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => setResettingId(null)}
                          className="p-2.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    )}

                    {/* Edit inline */}
                    {editingId === u.id && (
                      <EditUserRow u={u} onSave={saveEdit} onCancel={() => setEditingId(null)} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </GlassCard>

      {/* About */}
      <GlassCard animated={false} className="cursor-default">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-bold text-white">عيادة سيرينيتي للجمال</h3>
          <h3 className="text-lg font-bold text-white">Serenity Beauty Clinic</h3>
          <div className="space-y-1 text-sm">
            <p className="text-gray-300">📍 ش. عبدالسلام عارف - برج علي بابا (الدور السادس)</p>
            <p className="text-gray-300">بني سويف - مصر</p>
            <p className="text-gold-400 font-bold">📞 01103032431</p>
            <p className="text-gray-500">━━━━━━━━━━━━━━━━━</p>
            <p className="text-gray-400">نظام تطوير: YoussefAhmed</p>
            <p className="text-xs text-gray-500">📱 01000139417</p>
          </div>
          <p className="text-xs text-gray-600 pt-2">© عيادة سيرينيتي للجمال 2026 | جميع الحقوق محفوظة</p>
        </div>
      </GlassCard>
    </div>
  )
}

interface EditUserRowProps {
  u: StaffUser
  onSave: (u: StaffUser, role: string, name: string, perms: string[]) => void
  onCancel: () => void
}

const EditUserRow: React.FC<EditUserRowProps> = ({ u, onSave, onCancel }) => {
  const { t } = useTranslation()
  const [editRole, setEditRole] = useState<string>(u.role)
  const [editName, setEditName] = useState<string>(u.name || '')
  const [editPerms, setEditPerms] = useState<string[]>(u.permissions || [])

  const toggle = (key: string) => {
    setEditPerms(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  }

  return (
    <div className="mt-3 rounded-lg bg-black/20 border border-white/10 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-gray-300 text-xs mb-1">{t('settings.user_name')}</label>
          <input value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-gray-300 text-xs mb-1">{t('settings.role')}</label>
          <select
            value={editRole}
            onChange={e => setEditRole(e.target.value)}
            className={`${inputClass} bg-slate-900`}
          >
            <option value="cashier">{t('settings.role_cashier')}</option>
            <option value="admin">{t('settings.role_admin')}</option>
          </select>
        </div>
      </div>

      {editRole === 'cashier' && (
        <div>
          <p className="text-gray-300 text-xs mb-2">{t('settings.permissions')}</p>
          <div className="flex flex-wrap gap-2">
            {PAGE_KEYS.map(key => {
              const checked = editPerms.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className={`px-2.5 py-1 rounded-lg border text-xs transition ${
                    checked
                      ? 'bg-gold-400/20 border-gold-400/50 text-gold-400'
                      : 'border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  {pageLabel(key, t)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => onSave(u, editRole, editName, editPerms)}
          className="px-4 py-2 rounded-lg bg-gold-400/20 text-gold-400 hover:bg-gold-400/30 transition text-sm font-semibold"
        >
          {t('common.save')}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition text-sm"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
