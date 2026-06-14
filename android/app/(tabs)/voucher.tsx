import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, RefreshControl, ActivityIndicator, TextInput, TouchableOpacity, Alert, Share } from 'react-native';
import { Text, View } from '@/components/Themed';
import { apiFetch } from '@/services/api';
import * as Print from 'expo-print';
import { useSearch } from './_layout';

export default function VoucherScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const { searchQuery } = useSearch();

  const fetchVouchers = async () => {
    try {
      const response = await apiFetch('/vouchers');
      setVouchers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch vouchers', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVouchers();
  };

  const getStatusColor = (status: string) => {
    if (status === 'Active') return '#10b981'; // green
    if (status === 'Unused') return '#64748b'; // slate
    return '#ef4444'; // red (Expired)
  };

  const getStatusText = (status: string) => {
    if (status === 'Active') return 'Aktif';
    if (status === 'Unused') return 'Waiting';
    return 'Expired';
  };

  const handleShare = async (item: any) => {
    try {
      const message = `Berikut adalah detail Voucher WiFi Anda:\n\nKode Voucher: ${item.code}\nPaket: ${item.package_name || '-'}\n\nTerima kasih.`;
      await Share.share({ message });
    } catch (error) {
      console.error(error);
    }
  };

  const handlePrint = async (item: any) => {
    try {
      const html = `
        <html>
          <body style="text-align: center; font-family: monospace; padding: 20px;">
            <h2>Kartu Voucher Hotspot</h2>
            <hr />
            <h3>KODE VOUCHER: ${item.code}</h3>
            <hr />
            <p>Paket: ${item.package_name || '-'}</p>
            <p>Terima kasih telah menggunakan layanan kami.</p>
          </body>
        </html>
      `;
      await Print.printAsync({ html });
    } catch (error) {
      console.error(error);
      Alert.alert('Gagal', 'Tidak dapat memproses printer');
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.codeText}>{item.code}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Paket:</Text>
          <Text style={styles.value}>{item.package_name || '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Pemakaian:</Text>
          <Text style={styles.value}>{item.usedBytes || '0 MB'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Sisa Waktu:</Text>
          <Text style={styles.value}>{item.timeLeft || '-'}</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(item)}>
          <Text style={styles.actionBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handlePrint(item)}>
          <Text style={styles.actionBtnText}>Print</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4D44E3" />
        <Text style={{ marginTop: 10 }}>Memuat Voucher...</Text>
      </View>
    );
  }

  const filteredVouchers = vouchers.filter((v: any) => 
    v.code?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    v.package_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Manajemen Voucher</Text>
      <FlatList
        data={filteredVouchers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Tidak ada voucher yang tersedia.</Text>
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
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  codeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4D44E3',
    fontFamily: 'monospace',
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
    backgroundColor: 'transparent',
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
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: 'transparent',
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  }
});
