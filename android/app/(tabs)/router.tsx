import { useColorScheme, Text, View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import Colors from '@/constants/Colors';
import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/services/api';
import { useSearch } from './_layout';

export default function RouterScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [routers, setRouters] = useState([]);
  const { searchQuery } = useSearch();

  const fetchRouters = async () => {
    try {
      const response = await apiFetch('/routers');
      setRouters(response.data || []);
    } catch (error) {
      console.error('Failed to fetch routers', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRouters();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRouters();
  };

  const getStatusColor = (status: string) => {
    if (status === 'Online') return '#10b981'; // green
    if (status === 'Offline') return '#ef4444'; // red
    if (status === 'Isolated') return '#f59e0b'; // orange
    return '#64748b';
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatar, { backgroundColor: colorScheme === 'dark' ? '#312e81' : '#e0e7ff' }]}>
            <Text style={styles.avatarText}>{item.customer_name ? item.customer_name.substring(0, 1).toUpperCase() : 'R'}</Text>
          </View>
          <View>
            <Text style={[styles.nameText, { color: colors.text }]}>{item.customer_name}</Text>
            <Text style={[styles.phoneText, { color: colors.textSecondary }]}>{item.active_ip || item.router_ip || 'IP Kosong'}</Text>
          </View>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>
      
      <View style={[styles.cardBody, { backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#f8fafc' }]}>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Paket Langganan:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.package_name || '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Username PPPoE:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.pppoe_user || '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>MAC Address:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.macAddress || '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Tgl Kedaluwarsa:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '-'}</Text>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4D44E3" />
        <Text style={{ marginTop: 10 }}>Memuat Router...</Text>
      </View>
    );
  }

  const filteredRouters = routers.filter((r: any) => 
    r.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.pppoe_user?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.active_ip?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>Router PPPoE</Text>
      <FlatList
        data={filteredRouters}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Tidak ada data router.</Text>
          </View>
        }
      />
    </View>
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
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4D44E3',
  },
  nameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  phoneText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardBody: {
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 13,
    color: '#64748b',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
  }
});
