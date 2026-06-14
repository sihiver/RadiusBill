import { useColorScheme, Text, View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import Colors from '@/constants/Colors';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/services/api';

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    vouchers: 0,
    members: 0,
    routers: 0,
    revenue: 0,
    onlineUsers: 0,
    revenueTrend: [],
  });

  const fetchDashboardData = async () => {
    try {
      const [vouchersRes, membersRes, routersRes, statsRes] = await Promise.all([
        apiFetch('/vouchers'),
        apiFetch('/members'),
        apiFetch('/routers'),
        apiFetch('/dashboard/stats')
      ]);
      
      let revenue = 0;
      if (statsRes && statsRes.data && statsRes.data.revenue) {
        revenue = statsRes.data.revenue.this_month || 0;
      }

      // Hitung User Online berdasarkan jumlah sesi aktif di RADIUS (radacct)
      let activeSessions = 0;
      if (statsRes && statsRes.data && statsRes.data.sessions) {
        activeSessions = parseInt(statsRes.data.sessions.active_sessions) || 0;
      }

      setStats({
        vouchers: vouchersRes.data ? vouchersRes.data.length : 0,
        members: membersRes.data ? membersRes.data.length : 0,
        routers: routersRes.data ? routersRes.data.length : 0,
        revenue: revenue,
        onlineUsers: activeSessions,
        revenueTrend: statsRes && statsRes.data && statsRes.data.revenueTrend ? statsRes.data.revenueTrend : [],
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Generate Chart Data for the last 7 days
  const generateChartData = (trendData: any[]) => {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const result = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = days[d.getDay()];

      let dailyAmt = 0;
      if (trendData) {
        trendData.forEach(row => {
          if (row.date === dateStr) {
            dailyAmt += Number(row.amount);
          }
        });
      }
      result.push({ day: dayName, amt: dailyAmt });
    }
    return result;
  };

  const chartData = generateChartData(stats.revenueTrend);
  const maxAmtInChart = Math.max(...chartData.map(i => i.amt), 100000); // Default min scale 100k
  const compactFormat = (val: number) => new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(val);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4D44E3" />
        <Text style={{ marginTop: 10 }}>Memuat Data...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >


      <View style={styles.grid}>
        <View style={[styles.fullCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Estimasi Pendapatan</Text>
          <Text style={styles.revenueValue}>
            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(stats.revenue)}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Total Voucher</Text>
          <Text style={styles.cardValue}>{stats.vouchers}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Total Member</Text>
          <Text style={styles.cardValue}>{stats.members}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Router Rumah</Text>
          <Text style={styles.cardValue}>{stats.routers}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>User Online</Text>
          <Text style={styles.cardValue}>{stats.onlineUsers}</Text>
        </View>
      </View>

      <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
        <View style={styles.chartHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Grafik Pendapatan (7 Hari Terakhir)</Text>
        </View>
        <View style={styles.chartContainer}>
          {chartData.map((item, idx) => {
            const percentage = Math.min((item.amt / maxAmtInChart) * 100, 100);
            const heightValue = percentage < 5 ? 5 : percentage; // Min 5% height
            return (
              <View key={idx} style={styles.barWrapper}>
                <Text style={styles.barValue}>{item.amt > 0 ? compactFormat(item.amt) : ''}</Text>
                <View style={[styles.bar, { height: `${heightValue}%` }]} />
                <Text style={styles.barLabel}>{item.day}</Text>
              </View>
            );
          })}
        </View>
      </View>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>Tarik ke bawah untuk memuat ulang data terbaru dari server.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  fullCard: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  chartCard: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    paddingTop: 20,
    backgroundColor: 'transparent',
  },
  barWrapper: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    flex: 1,
    backgroundColor: 'transparent',
  },
  bar: {
    width: 24,
    backgroundColor: '#10b981',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    marginTop: 8,
    fontSize: 10,
    color: '#64748b',
    fontWeight: 'bold',
  },
  barValue: {
    marginBottom: 4,
    fontSize: 9,
    color: '#10b981',
    fontWeight: 'bold',
  },
  cardTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  revenueValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 8,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4D44E3',
    marginTop: 8,
  },
  infoBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
  },
  infoText: {
    color: '#3730a3',
    textAlign: 'center',
  }
});
