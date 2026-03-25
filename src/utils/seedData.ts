import { supabase, Client, Service, Booking } from '../db/supabase'

export const seedSampleData = async () => {
  try {
    // Sample clients
    const sampleClients: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'أحمد محمد',
        phone: '01001234567',
        birthday: '1990-05-15',
        notes: 'عميل مميز، يفضل الحلاقة العصرية',
        totalVisits: 15,
        totalSpent: 450,
        isVIP: true,
        lastVisit: new Date().toISOString().split('T')[0],
      },
      {
        name: 'محمود علي',
        phone: '01012345678',
        birthday: '1995-08-20',
        notes: 'يفضل الخدمات السريعة',
        totalVisits: 8,
        totalSpent: 240,
        isVIP: false,
        lastVisit: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      {
        name: 'سارة إبراهيم',
        phone: '01023456789',
        birthday: '1992-03-10',
        notes: 'تفضل الخدمات الكاملة',
        totalVisits: 20,
        totalSpent: 600,
        isVIP: true,
        lastVisit: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      {
        name: 'علي حسن',
        phone: '01034567890',
        birthday: '1998-11-05',
        notes: '',
        totalVisits: 3,
        totalSpent: 90,
        isVIP: false,
        lastVisit: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      {
        name: 'خالد أحمد',
        phone: '01045678901',
        birthday: '1988-07-22',
        notes: 'عميل قديم وموثوق',
        totalVisits: 25,
        totalSpent: 750,
        isVIP: true,
        lastVisit: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    ]

    // Sample services
    const sampleServices: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        nameAr: 'حلاقة شعر عادية',
        nameEn: 'Regular Haircut',
        price: 30,
        duration: 20,
        category: 'haircut',
        active: true,
      },
      {
        nameAr: 'حلاقة شعر فاخرة',
        nameEn: 'Premium Haircut',
        price: 50,
        duration: 30,
        category: 'haircut',
        active: true,
      },
      {
        nameAr: 'حلاقة لحية',
        nameEn: 'Beard Trim',
        price: 25,
        duration: 15,
        category: 'beard',
        active: true,
      },
      {
        nameAr: 'لحية وحلاقة شاملة',
        nameEn: 'Complete Beard & Hair',
        price: 60,
        duration: 35,
        category: 'beard',
        active: true,
      },
      {
        nameAr: 'عناية بالبشرة',
        nameEn: 'Facial Care',
        price: 40,
        duration: 25,
        category: 'skincare',
        active: true,
      },
      {
        nameAr: 'حلاقة أطفال',
        nameEn: "Kids Haircut",
        price: 20,
        duration: 15,
        category: 'kids',
        active: true,
      },
      {
        nameAr: 'باقة كاملة',
        nameEn: 'Complete Package',
        price: 100,
        duration: 50,
        category: 'packages',
        active: true,
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
          
          const sampleBookings: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>[] = [
            {
              clientId: clients[0].id,
              clientName: clients[0].name,
              clientPhone: clients[0].phone,
              barberId: undefined,
              barberName: undefined,
              serviceType: 'حلاقة عادية',
              bookingTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0).toISOString(),
              duration: 30,
              queueNumber: 1,
              status: 'pending',
            },
            {
              clientId: clients[1]?.id || clients[0].id,
              clientName: clients[1]?.name || clients[0].name,
              clientPhone: clients[1]?.phone || clients[0].phone,
              barberId: undefined,
              barberName: undefined,
              serviceType: 'حلاقة + لحية',
              bookingTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 45).toISOString(),
              duration: 45,
              queueNumber: 2,
              status: 'pending',
            },
            {
              clientId: clients[2]?.id || clients[0].id,
              clientName: clients[2]?.name || clients[0].name,
              clientPhone: clients[2]?.phone || clients[0].phone,
              barberId: undefined,
              barberName: undefined,
              serviceType: 'حلاقة عصرية',
              bookingTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 14, 30).toISOString(),
              duration: 30,
              queueNumber: 1,
              status: 'pending',
            },
          ]

          for (const booking of sampleBookings) {
            // Convert to lowercase column names for PostgreSQL
            const dbBooking = {
              clientid: booking.clientId,
              clientname: booking.clientName,
              clientphone: booking.clientPhone,
              barberid: booking.barberId,
              barbername: booking.barberName,
              servicetype: booking.serviceType,
              bookingtime: booking.bookingTime,
              duration: booking.duration,
              queuenumber: booking.queueNumber,
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
