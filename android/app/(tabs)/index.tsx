import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { apiFetch } from '@/services/api';

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    vouchers: 0,
    members: 0,
    routers: 0,
  });

  const fetchDashboardData = async () => {
    try {
      const [vouchersRes, membersRes, routersRes] = await Promise.all([
        apiFetch('/vouchers'),
        apiFetch('/members'),
        apiFetch('/routers')
      ]);
      
      setStats({
        vouchers: vouchersRes.data ? vouchersRes.data.length : 0,
        members: membersRes.data ? membersRes.data.length : 0,
        routers: routersRes.data ? routersRes.data.length : 0,
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
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard Utama</Text>
        <Text style={styles.subtitle}>Ringkasan Sistem RT/RW Net</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Voucher</Text>
          <Text style={styles.cardValue}>{stats.vouchers}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Member</Text>
          <Text style={styles.cardValue}>{stats.members}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Router Rumah</Text>
          <Text style={styles.cardValue}>{stats.routers}</Text>
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
    padding: 16,
  },
  header: {
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
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
  cardTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
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
