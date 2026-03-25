import { supabase, Client, Service, Booking } from '../db/supabase'

export const seedSampleData = async () => {
  try {
    // Sample clients
    const sampleClients: Omit<Client, 'id'>[] = [
      {
        name: 'أحمد محمد',
        phone: '01001234567',
        birthday: '1990-05-15',
        notes: 'عميل مميز، يفضل الحلاقة العصرية',
        total_visits: 15,
        total_spent: 450,
        is_vip: true,
        last_visit: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        name: 'محمود علي',
        phone: '01012345678',
        birthday: '1995-08-20',
        notes: 'يفضل الخدمات السريعة',
        total_visits: 8,
        total_spent: 240,
        is_vip: false,
        last_visit: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      {
        name: 'سارة إبراهيم',
        phone: '01023456789',
        birthday: '1992-03-10',
        notes: 'تفضل الخدمات الكاملة',
        total_visits: 20,
        total_spent: 600,
        is_vip: true,
        last_visit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      {
        name: 'علي حسن',
        phone: '01034567890',
        birthday: '1998-11-05',
        notes: '',
        total_visits: 3,
        total_spent: 90,
        is_vip: false,
        last_visit: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      {
        name: 'خالد أحمد',
        phone: '01045678901',
        birthday: '1988-07-22',
        notes: 'عميل قديم وموثوق',
        total_visits: 25,
        total_spent: 750,
        is_vip: true,
        last_visit: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    ]

    // Sample services
    const sampleServices: Omit<Service, 'id'>[] = [
      {
        nameAr: 'حلاقة شعر عادية',
        nameEn: 'Regular Haircut',
        price: 30,
        duration: 20,
        category: 'haircut',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        nameAr: 'حلاقة شعر فاخرة',
        nameEn: 'Premium Haircut',
        price: 50,
        duration: 30,
        category: 'haircut',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        nameAr: 'حلاقة لحية',
        nameEn: 'Beard Trim',
        price: 25,
        duration: 15,
        category: 'beard',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        nameAr: 'لحية وحلاقة شاملة',
        nameEn: 'Complete Beard & Hair',
        price: 60,
        duration: 35,
        category: 'beard',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        nameAr: 'عناية بالبشرة',
        nameEn: 'Facial Care',
        price: 40,
        duration: 25,
        category: 'skincare',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        nameAr: 'حلاقة أطفال',
        nameEn: "Kids Haircut",
        price: 20,
        duration: 15,
        category: 'kids',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        nameAr: 'باقة كاملة',
        nameEn: 'Complete Package',
        price: 100,
        duration: 50,
        category: 'packages',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    // Check if data already exists
    const { count: clientCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })

    if ((clientCount ?? 0) === 0) {
      // Insert clients
      for (const client of sampleClients) {
        await supabase.from('clients').insert({
          ...client,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
      console.log('✅ Sample clients inserted')
    }

    const { count: serviceCount } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })

    if ((serviceCount ?? 0) === 0) {
      // Insert services
      for (const service of sampleServices) {
        await supabase.from('services').insert({
          ...service,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
      console.log('✅ Sample services inserted')
    }

    // Insert sample settings
    const defaultSettings = [
      { key: 'barbershipName', value: 'محل حلاقة الملاك' },
      { key: 'barbershipNameEn', value: 'Angel Barbershop' },
      { key: 'barbershipPhone', value: '01012345678' },
      { key: 'language', value: 'ar' },
      { key: 'theme', value: 'dark' },
      { key: 'vipThreshold', value: { type: 'visits', value: 10 } },
    ]

    for (const setting of defaultSettings) {
      const { count } = await supabase
        .from('settings')
        .select('*', { count: 'exact', head: true })
        .eq('key', setting.key)

      if ((count ?? 0) === 0) {
        await supabase.from('settings').insert({
          ...setting,
          updatedAt: new Date().toISOString(),
        })
      }
    }

    // Insert sample bookings if table exists
    try {
      const { count: bookingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })

      if ((bookingCount ?? 0) === 0) {
        // Get first client for demo bookings
        const { data: clients } = await supabase.from('clients').select('*').limit(5)
        
        if (clients && clients.length > 0) {
          const today = new Date()
          const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
          
          const sampleBookings: Omit<Booking, 'id'>[] = [
            {
              client_id: clients[0].id,
              client_name: clients[0].name,
              client_phone: clients[0].phone,
              barber_id: undefined,
              barber_name: undefined,
              service_type: 'حلاقة عادية',
              booking_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0).toISOString(),
              duration: 30,
              queue_number: 1,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
            {
              client_id: clients[1]?.id || clients[0].id,
              client_name: clients[1]?.name || clients[0].name,
              client_phone: clients[1]?.phone || clients[0].phone,
              barber_id: undefined,
              barber_name: undefined,
              service_type: 'حلاقة + لحية',
              booking_time: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 45).toISOString(),
              duration: 45,
              queue_number: 2,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
            {
              client_id: clients[2]?.id || clients[0].id,
              client_name: clients[2]?.name || clients[0].name,
              client_phone: clients[2]?.phone || clients[0].phone,
              barber_id: undefined,
              barber_name: undefined,
              service_type: 'حلاقة عصرية',
              booking_time: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 30).toISOString(),
              duration: 30,
              queue_number: 1,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
          ]

          for (const booking of sampleBookings) {
            // Convert to lowercase column names for PostgreSQL
            const dbBooking = {
              client_id: booking.client_id,
              client_name: booking.client_name,
              client_phone: booking.client_phone,
              barber_id: booking.barber_id,
              barber_name: booking.barber_name,
              service_type: booking.service_type,
              booking_time: booking.booking_time,
              duration: booking.duration,
              queue_number: booking.queue_number,
              status: booking.status,
              notes: booking.notes,
              createdat: new Date().toISOString(),
              updatedat: new Date().toISOString(),
            }
            await supabase.from('bookings').insert(dbBooking)
          }
          console.log('✅ Sample bookings inserted')
        }
      }
    } catch (err) {
      // Bookings table may not exist yet
      console.log('ℹ️ Bookings table not found, skipping seed data')
    }

    console.log('✅ Sample data initialized successfully')
  } catch (error) {
    console.error('Error seeding data:', error)
  }
}
