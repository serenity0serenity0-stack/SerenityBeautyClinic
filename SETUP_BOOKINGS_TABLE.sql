-- نموذج SQL لإنشاء جدول الحجوزات في Supabase
-- قم بالذهاب إلى Supabase Dashboard → SQL Editor وقم بتنفيذ:

-- حذف الجدول القديم إن وجد (اختياري - انتبه!"): 
-- DROP TABLE IF EXISTS bookings;

-- إنشاء الجدول:
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clientId UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  clientName VARCHAR(255) NOT NULL,
  clientPhone VARCHAR(20) NOT NULL,
  barberId UUID,
  barberName VARCHAR(255),
  serviceType VARCHAR(255),
  bookingTime TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER DEFAULT 30,
  queueNumber INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_barber FOREIGN KEY (barberId) REFERENCES barbers(id) ON DELETE SET NULL
);

-- إضافة indexes للبحث السريع:
CREATE INDEX IF NOT EXISTS idx_bookings_clientId ON bookings(clientId);
CREATE INDEX IF NOT EXISTS idx_bookings_barberId ON bookings(barberId);
CREATE INDEX IF NOT EXISTS idx_bookings_bookingTime ON bookings(bookingTime);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_queueNumber ON bookings(queueNumber);

-- تفعيل RLS (اختياري لأمان أفضل):
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow all operations for now" ON bookings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- التحقق من الجدول:
SELECT * FROM bookings LIMIT 1;
