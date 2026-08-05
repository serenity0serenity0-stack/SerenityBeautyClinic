import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Users,
  Zap,
  AlertCircle,
  CheckCircle2,

} from 'lucide-react'
import { useQueueStatus } from '../db/hooks/useQueueStatus'
import logo from '../assets/serenity-logo.png'

export const QueueDisplay: React.FC = () => {
  const { t } = useTranslation()
  const { queueInfo, currentTime } = useQueueStatus()
  const [displayMode, setDisplayMode] = useState<'large' | 'compact'>('large')

  // Auto-switch to large display on page load
  useEffect(() => {
    setDisplayMode('large')
  }, [])

  if (displayMode === 'large') {
    return (
      <div className="force-dark w-full h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-4xl"
        >
          {/* Main Content */}
          <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-3xl border-2 border-slate-700 p-12 shadow-2xl">
            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <img
                src={logo}
                alt={t('common.appName')}
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-full mx-auto mb-6"
              />
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                {t('bookings:queueAhead') || 'أمامك في الدور'}
              </h1>
              <p className="text-slate-400 text-lg">
                {t('common:today') || 'اليوم'}
              </p>
            </motion.div>

            {/* Three Main Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              {/* People Ahead */}
              <motion.div
                whileHover={{ scale: 1.05, rotateZ: 1 }}
                className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 text-center cursor-pointer shadow-lg"
              >
                <Users className="w-12 h-12 text-blue-200 mx-auto mb-4" />
                <p className="text-blue-200 text-lg font-semibold mb-3">
                  {t('bookings:queueAhead') || 'أمامك في الدور'}
                </p>
                <motion.div
                  key={queueInfo.peopleAhead}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="text-7xl font-black text-white"
                >
                  {queueInfo.peopleAhead}
                </motion.div>
                <p className="text-blue-200 text-sm mt-4">
                  {queueInfo.peopleAhead === 0
                    ? t('bookings:yourTurn') || 'دورك الآن'
                    : `${queueInfo.peopleAhead} ${t('bookings:person') || 'شخص'}`}
                </p>
              </motion.div>

              {/* Wait Time */}
              <motion.div
                whileHover={{ scale: 1.05, rotateZ: -1 }}
                className="bg-gradient-to-br from-amber-600 to-amber-800 rounded-2xl p-8 text-center cursor-pointer shadow-lg"
              >
                <Clock className="w-12 h-12 text-amber-200 mx-auto mb-4" />
                <p className="text-amber-200 text-lg font-semibold mb-3">
                  {t('bookings:expectedWait') || 'الانتظار المتوقع'}
                </p>
                <motion.div
                  key={queueInfo.waitingMinutes}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="text-7xl font-black text-white"
                >
                  {queueInfo.waitingMinutes}
                </motion.div>
                <p className="text-amber-200 text-sm mt-4">
                  {t('bookings:minute') || 'دقيقة'}
                </p>
              </motion.div>

              {/* Completion Time */}
              <motion.div
                whileHover={{ scale: 1.05, rotateZ: 1 }}
                className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-8 text-center cursor-pointer shadow-lg"
              >
                <Zap className="w-12 h-12 text-green-200 mx-auto mb-4" />
                <p className="text-green-200 text-lg font-semibold mb-3">
                  {t('bookings:expectedTime') || 'الوقت المتوقع'}
                </p>
                <motion.div
                  key={queueInfo.estimatedTime}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-5xl font-black text-white font-mono"
                >
                  {queueInfo.estimatedTime}
                </motion.div>
                <p className="text-green-200 text-sm mt-4">
                  {t('bookings:completionTime') || 'وقت الانتهاء'}
                </p>
              </motion.div>
            </div>

            {/* Current Time Bar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-slate-400" />
                <span className="text-slate-300 text-xl">
                  {t('bookings:currentTime') || 'الوقت الحالي'}
                </span>
              </div>
              <motion.div
                key={currentTime.getSeconds()}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-4xl font-black text-green-400 font-mono"
              >
                {currentTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',                  hour12: true,                })}
              </motion.div>
            </motion.div>

            {/* Status Message */}
            <AnimatePresence mode="wait">
              {queueInfo.isWaiting ? (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-blue-900/50 border-2 border-blue-500 rounded-xl p-6 flex items-start gap-4"
                >
                  <AlertCircle className="w-8 h-8 text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-xl text-blue-200 font-semibold mb-2">
                      {t('bookings:waiting') || 'في الانتظار'}
                    </p>
                    <p className="text-blue-200 text-lg">
                      {queueInfo.peopleAhead === 0
                        ? t('bookings:noQueue') ||
                          'لا يوجد انتظار حالياً. دورك الآن!'
                        : `هناك ${queueInfo.peopleAhead} ${t('bookings:person') || 'شخص'} أمامك. الوقت المتوقع للانتظار حوالي ${queueInfo.waitingMinutes} ${t('bookings:minute') || 'دقيقة'}.`}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-green-900/50 border-2 border-green-500 rounded-xl p-6 flex items-start gap-4"
                >
                  <CheckCircle2 className="w-8 h-8 text-green-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-xl text-green-200 font-semibold mb-2">
                      {t('bookings:yourTurn') || 'دورك الآن'}
                    </p>
                    <p className="text-green-200 text-lg">
                      {t('bookings:noQueue') ||
                        'لا يوجد انتظار حالياً. نحن مستعدون لاستقبالك!'}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-12"
          >
            <p className="text-slate-400 text-lg">
              شكراً لانتظاركم • Thank you for waiting
            </p>
            <button
              onClick={() => setDisplayMode('compact')}
              className="mt-4 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              {t('common:close') || 'إغلاق'}
            </button>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // Compact Mode (Sidebar Widget)
  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="force-dark bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-lg border border-slate-700 p-4 shadow-lg"
      >
        <div className="grid grid-cols-3 gap-3">
          {/* Queue Position */}
          <div className="bg-blue-600 rounded-lg p-3 text-center">
            <Users className="w-5 h-5 text-blue-200 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">
              {queueInfo.peopleAhead}
            </p>
            <p className="text-xs text-blue-200">
              {t('bookings:queue') || 'الدور'}
            </p>
          </div>

          {/* Wait Time */}
          <div className="bg-amber-600 rounded-lg p-3 text-center">
            <Clock className="w-5 h-5 text-amber-200 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">
              {queueInfo.waitingMinutes}m
            </p>
            <p className="text-xs text-amber-200">
              {t('bookings:wait') || 'انتظار'}
            </p>
          </div>

          {/* Ready Time */}
          <div className="bg-green-600 rounded-lg p-3 text-center">
            <Zap className="w-5 h-5 text-green-200 mx-auto mb-2" />
            <p className="text-sm font-bold text-white">
              {queueInfo.estimatedTime}
            </p>
            <p className="text-xs text-green-200">
              {t('bookings:ready') || 'جاهز'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setDisplayMode('large')}
          className="w-full mt-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
        >
          {t('common:expand') || 'عرض كامل'}
        </button>
      </motion.div>
    </div>
  )
}
