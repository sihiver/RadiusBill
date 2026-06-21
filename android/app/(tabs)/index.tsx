import { useColorScheme, Text, View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import Colors from '@/constants/Colors';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/services/api';
import { FontAwesome } from '@expo/vector-icons';

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
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
      const [vouchersRes, membersRes, routersRes, statsRes, logsRes] = await Promise.all([
        apiFetch('/vouchers?limit=10000'),
        apiFetch('/members'),
        apiFetch('/routers'),
        apiFetch('/dashboard/stats'),
        apiFetch('/radius/logs?limit=15')
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

      if (logsRes && logsRes.success && logsRes.data) {
        const mapped = logsRes.data.map((l: any, idx: number) => {
          const timeStr = new Date(l.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          return {
            id: idx.toString(),
            time: timeStr,
            type: l.log_type, // 'AUTH', 'REJECT', 'ACCT', 'SYSTEM'
            user: l.username,
            ip: l.ip_address || '-',
            service: l.service || 'RADIUS',
            action: l.action || (l.reply === 'Access-Accept' ? 'Accept' : l.reply),
            session: l.session_id || '-',
            reason: l.reason || l.reply || '-',
            message: l.message,
            timestamp: new Date(l.created_at).getTime()
          };
        });
        setLogs(mapped);
      }
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
      
      <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.logHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.logHeaderTitle}>
            <FontAwesome name="terminal" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Interface Log</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colorScheme === 'dark' ? '#312e81' : '#e0e7ff' }]}>
            <Text style={[styles.badgeText, { color: colorScheme === 'dark' ? '#c7d2fe' : '#4f46e5' }]}>FreeRADIUS</Text>
          </View>
        </View>

        <View style={styles.logList}>
          {logs.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Mendengarkan permintaan autentikasi FreeRADIUS...</Text>
          ) : (
            logs.map((log) => {
              let iconName: any = 'info-circle';
              let iconColor = '#64748b';
              let logTitle = '';
              let logSubtitle = '';

              if (log.type === 'AUTH') {
                iconName = 'check-circle';
                iconColor = colors.success || '#10b981';
                logTitle = log.user;
                logSubtitle = `berhasil terhubung (${log.ip})`;
              } else if (log.type === 'REJECT') {
                iconName = 'times-circle';
                iconColor = colors.danger || '#ef4444';
                logTitle = log.user;
                logSubtitle = `Gagal: ${log.reason}`;
              } else if (log.type === 'ACCT') {
                if (log.action === 'Start') {
                  iconName = 'sign-in';
                  iconColor = colors.success || '#10b981';
                  logTitle = log.user;
                  logSubtitle = 'sesi dimulai';
                } else if (log.action === 'Stop') {
                  iconName = 'sign-out';
                  iconColor = colors.danger || '#ef4444';
                  logTitle = log.user;
                  logSubtitle = `sesi berakhir (${log.reason || 'Logout'})`;
                } else {
                  iconName = 'refresh';
                  iconColor = '#3b82f6';
                  logTitle = log.user;
                  logSubtitle = 'sesi diperbarui';
                }
              } else if (log.type === 'SYSTEM') {
                iconName = 'info-circle';
                iconColor = '#3b82f6';
                logTitle = 'SISTEM';
                logSubtitle = log.message || '';
              }

              return (
                <View key={log.id} style={[styles.logRow, { borderBottomColor: colors.border + '33' }]}>
                  <Text style={[styles.logTime, { color: colors.textSecondary }]}>{log.time}</Text>
                  <FontAwesome name={iconName} size={14} color={iconColor} style={styles.logIcon} />
                  <View style={styles.logContent}>
                    <Text style={[styles.logText, { color: colors.text }]} numberOfLines={2}>
                      <Text style={styles.logUser}>{logTitle} </Text>
                      <Text style={{ color: colors.textSecondary }}>{logSubtitle}</Text>
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
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
  logCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  logHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  logList: {
    flexDirection: 'column',
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
    fontSize: 12,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  logTime: {
    fontSize: 11,
    fontFamily: 'monospace',
    width: 65,
  },
  logIcon: {
    marginHorizontal: 8,
  },
  logContent: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
  },
  logUser: {
    fontWeight: 'bold',
  }
});
