import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Users, AlertCircle, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { useBookings } from '../../db/hooks/useBookings'
import { getEgyptDateString } from '../../utils/egyptTime'

interface QueueInfo {
  peopleAhead: number
  waitingMinutes: number
  currentTime: string
  estimatedTime: string
  nextAvailablebarber_id?: string
  isWaiting: boolean
}

export const QueueStatus: React.FC = () => {
  const { t } = useTranslation()
  const { bookings } = useBookings()
  const [queueInfo, setQueueInfo] = useState<QueueInfo>({
    peopleAhead: 0,
    waitingMinutes: 0,
    currentTime: '',
    estimatedTime: '',
    isWaiting: false,
  })
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every second for real-time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Calculate queue status in real-time
  useEffect(() => {
    const calculateQueue = () => {
      try {
        const today = getEgyptDateString()
        
        // Get all pending and ongoing bookings for today, sorted by time
        const todayBookings = bookings
          .filter((b) => {
            const booking_date = new Date(b.booking_time).toLocaleDateString('en-CA')
            const todayDate = new Date(today).toLocaleDateString('en-CA')
            return (
              booking_date === todayDate &&
              (b.status === 'pending' || b.status === 'ongoing')
            )
          })
          .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

        if (todayBookings.length === 0) {
          setQueueInfo({
            peopleAhead: 0,
            waitingMinutes: 0,
            currentTime: currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            }),
            estimatedTime: currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }),
            isWaiting: false,
          })
          return
        }

        // Calculate wait time based on bookings ahead
        let totalWaitMinutes = 0
        let peopleAhead = 0

        // Add buffer for bookings that are still ongoing or starting soon
        todayBookings.forEach((booking) => {
          const bookingStartTime = new Date(booking.booking_time)
          const duration = booking.duration || 30 // default 30 minutes if not specified

          // Only count bookings that haven't finished yet
          if (bookingStartTime.getTime() > currentTime.getTime()) {
            peopleAhead++
            totalWaitMinutes += duration
          } else if (
            booking.status === 'ongoing' &&
            bookingStartTime.getTime() + duration * 60000 > currentTime.getTime()
          ) {
            // Current booking is still ongoing, add remaining time
            const remainingTime = Math.ceil(
              (bookingStartTime.getTime() + duration * 60000 - currentTime.getTime()) /
                60000
            )
            totalWaitMinutes += remainingTime
          }
        })

        // Add total wait time to current time to get estimated completion
        const finalEstimatedTime = new Date(
          currentTime.getTime() + totalWaitMinutes * 60000
        )

        setQueueInfo({
          peopleAhead,
          waitingMinutes: Math.max(0, totalWaitMinutes),
          currentTime: currentTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          }),
          estimatedTime: finalEstimatedTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',            hour12: true,          }),
          isWaiting: peopleAhead > 0,
        })
      } catch (error) {
        console.error('Error calculating queue:', error)
      }
    }

    calculateQueue()
  }, [bookings, currentTime])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      {/* Main Queue Status Card */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-xl border border-slate-700 p-6 shadow-2xl">
        {/* Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* People Ahead */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-200 text-sm font-medium">
                {t('queueAhead') || 'أمامك في الدور'}
              </span>
              <Users className="w-4 h-4 text-blue-200" />
            </div>
            <motion.div
              key={queueInfo.peopleAhead}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-3xl font-bold text-white"
            >
              {queueInfo.peopleAhead}
            </motion.div>
            <p className="text-blue-200 text-xs mt-1">
              {queueInfo.peopleAhead === 0
                ? t('yourTurn') || 'دورك الآن'
                : `${queueInfo.peopleAhead} ${t('person') || 'شخص'}`}
            </p>
          </motion.div>

          {/* Expected Wait Time */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg p-4 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-200 text-sm font-medium">
                {t('expectedWait') || 'الانتظار المتوقع'}
              </span>
              <Clock className="w-4 h-4 text-amber-200" />
            </div>
            <motion.div
              key={queueInfo.waitingMinutes}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-3xl font-bold text-white"
            >
              {queueInfo.waitingMinutes}
            </motion.div>
            <p className="text-amber-200 text-xs mt-1">
              {t('minute') || 'دقيقة'}
            </p>
          </motion.div>

          {/* Expected Time */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-4 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-200 text-sm font-medium">
                {t('expectedTime') || 'الوقت المتوقع'}
              </span>
              <Zap className="w-4 h-4 text-green-200" />
            </div>
            <motion.div
              key={queueInfo.estimatedTime}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-3xl font-bold text-white font-mono"
            >
              {queueInfo.estimatedTime}
            </motion.div>
            <p className="text-green-200 text-xs mt-1">
              {t('completionTime') || 'وقت الانتهاء'}
            </p>
          </motion.div>
        </div>

        {/* Current Time Footer */}
        <div className="mt-6 pt-6 border-t border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              {t('currentTime') || 'الوقت الحالي'}:
            </span>
          </div>
          <motion.div
            key={currentTime.getSeconds()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-lg font-mono font-bold text-white"
          >
            {currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            })}
          </motion.div>
        </div>

        {/* Status Alert */}
        {queueInfo.isWaiting && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-blue-900/50 border border-blue-500/50 rounded-lg flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              {t('queueMessage') ||
                `هناك ${queueInfo.peopleAhead} أشخاص أمامك. الوقت المتوقع للانتظار حوالي ${queueInfo.waitingMinutes} دقيقة.`}
            </div>
          </motion.div>
        )}

        {!queueInfo.isWaiting && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-green-900/50 border border-green-500/50 rounded-lg flex items-start gap-3"
          >
            <Zap className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-200">
              {t('noQueue') || 'لا يوجد انتظار حالياً. دورك الآن!'}
            </div>
          </motion.div>
        )}
      </div>

      {/* Compact Mode - Optional Smaller Widget */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center"
        >
          <div className="text-xs text-slate-400 mb-1">{t('queue') || 'الدور'}</div>
          <div className="text-2xl font-bold text-blue-400">
            #{queueInfo.peopleAhead}
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center"
        >
          <div className="text-xs text-slate-400 mb-1">
            {t('wait') || 'انتظار'}
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {queueInfo.waitingMinutes}m
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center"
        >
          <div className="text-xs text-slate-400 mb-1">
            {t('now') || 'الآن'}
          </div>
          <div className="text-lg font-bold text-green-400 font-mono">
            {currentTime.toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center"
        >
          <div className="text-xs text-slate-400 mb-1">
            {t('ready') || 'جاهز'}
          </div>
          <div className="text-lg font-bold text-green-400 font-mono">
            {queueInfo.estimatedTime}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
