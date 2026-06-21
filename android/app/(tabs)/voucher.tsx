import { useColorScheme, Text, View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TextInput, TouchableOpacity, Alert, Share } from 'react-native';
import Colors from '@/constants/Colors';
import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/services/api';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

let BLEPrinter: any = null;
try {
  const printer = require('react-native-thermal-receipt-printer-image-qr');
  BLEPrinter = printer.BLEPrinter;
} catch (error) {
  // Ignore in Expo Go
}
import { useSearch } from './_layout';

export default function VoucherScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [packages, setPackages] = useState<any[]>([]);
  const { searchQuery } = useSearch();

  const fetchVouchers = async () => {
    try {
      const [vouchersRes, packagesRes] = await Promise.all([
        apiFetch('/vouchers?limit=10000'),
        apiFetch('/packages?type=Hotspot')
      ]);
      setVouchers(vouchersRes.data || []);
      setPackages(packagesRes.data || []);
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
      if (BLEPrinter) {
        let printData = '';
        try {
          const today = new Date();
          const dateStr = today.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const timeStr = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const invId = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

          const pkg = packages.find((p: any) => p.name === item.package_name || p.id === item.package_id);
          const price = pkg ? pkg.price : (item.price || 0);

          printData = '================================\n';
          printData += '     MQL.net BILLING SYSTEM     \n';
          printData += '          HOTSPOT & ISP         \n';
          printData += '       Telp: 085311753779       \n';
          printData += '================================\n\n';
          printData += `Tanggal : ${dateStr} ${timeStr}\n`;
          printData += `ID Trans: ${invId}\n`;
          printData += 'Kasir   : Admin\n\n';
          printData += '-------- DETAIL AKUN --------\n';
          printData += `Voucher    : ${item.code}\n`;
          printData += `Paket      : ${item.package_name || 'Voucher Hotspot'}\n`;
          printData += `Harga      : Rp ${price.toLocaleString('id-ID')}\n`;
          printData += `Durasi     : ${item.duration || (pkg ? pkg.duration : 'Sesuai Paket')}\n`;
          printData += `Masa Aktif : ${item.validity || (pkg ? pkg.validity : 'Sesuai Paket')}\n`;
          printData += `Kuota      : ${item.quota || 'Tidak Terbatas'}\n`;
          printData += '-------- TERIMA KASIH --------\n';
          printData += '  Layanan Cepat & Terjangkau  \n';
          printData += 'Simpan struk ini sebagai bukti\n';
          printData += '================================\n\n\n';
          
          await BLEPrinter.printBill(printData);
          Alert.alert('Sukses', 'Struk voucher berhasil dicetak ke printer Bluetooth');
          return;
        } catch (printErr: any) {
          console.log('Bluetooth print failed, trying to reconnect...', printErr);
          try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const savedPrinter = await AsyncStorage.getItem('saved_printer');
            if (savedPrinter) {
              try {
                await BLEPrinter.closeConn();
              } catch (e) {}
              await BLEPrinter.connectPrinter(savedPrinter);
              await BLEPrinter.printBill(printData);
              Alert.alert('Sukses', 'Struk voucher berhasil dicetak (Reconnected)');
              return;
            }
          } catch (retryErr) {
            console.log('Retry failed', retryErr);
          }
          // Fallback to PDF if not connected
        }
      }

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              @page { margin: 0; size: 58mm auto; }
              body {
                margin: 0;
                padding: 10px;
                width: 58mm;
                font-family: monospace;
                font-size: 12px;
                color: #000;
                text-align: center;
              }
              h2 { font-size: 16px; margin: 5px 0; }
              h3 { font-size: 18px; margin: 10px 0; font-weight: bold; border: 1px solid #000; padding: 5px; }
              p { margin: 5px 0; }
              .dashed-line { border-top: 1px dashed #000; margin: 10px 0; }
            </style>
          </head>
          <body>
            <h2>BILLING RADIUS</h2>
            <div class="dashed-line"></div>
            <p>Voucher Hotspot</p>
            <h3>${item.code}</h3>
            <p>Paket: <b>${item.package_name || '-'}</b></p>
            <div class="dashed-line"></div>
            <p style="font-size: 10px;">Gunakan kode di atas untuk login ke jaringan WiFi kami.</p>
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
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.codeText, { color: colors.text }]}>{item.code}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Paket:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.package_name || '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Pemakaian:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.usedBytes || '0 MB'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Sisa Waktu:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.timeLeft || '-'}</Text>
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: colorScheme === 'dark' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(59, 130, 246, 0.15)' }]} 
          onPress={() => handleShare(item)}
        >
          <Text style={[styles.actionBtnText, { color: colorScheme === 'dark' ? '#60a5fa' : '#3b82f6' }]}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: colorScheme === 'dark' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.15)' }]} 
          onPress={() => handlePrint(item)}
        >
          <Text style={[styles.actionBtnText, { color: colorScheme === 'dark' ? '#34d399' : '#10b981' }]}>Print</Text>
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>

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
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
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
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
