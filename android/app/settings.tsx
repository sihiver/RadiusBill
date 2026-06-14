import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';

// In Expo Go, native modules might not be available
let BluetoothManager: any = null;
let BluetoothEscposPrinter: any = null;

try {
  const printer = require('react-native-thermal-receipt-printer-image-qr');
  BluetoothManager = printer.BluetoothManager;
  BluetoothEscposPrinter = printer.BluetoothEscposPrinter;
} catch (error) {
  console.log('Bluetooth printing module not available in this environment');
}

export default function SettingsScreen() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);

  useEffect(() => {
    // Attempt to load paired devices on mount if module is available
    if (BluetoothManager) {
      loadPairedDevices();
    }
  }, []);

  const loadPairedDevices = async () => {
    try {
      const devicesStr = await BluetoothManager.enableBluetooth();
      const paired = JSON.parse(devicesStr || '[]');
      if (paired && paired.length > 0) {
        setDevices(paired);
      }
    } catch (e: any) {
      console.log('Enable bluetooth failed:', e);
    }
  };

  const scanDevices = async () => {
    if (!BluetoothManager) {
      Alert.alert('Info', 'Fitur Bluetooth tidak didukung pada Expo Go. Gunakan Development Build (APK).');
      return;
    }
    setIsScanning(true);
    setDevices([]);
    try {
      const res = await BluetoothManager.scanDevices();
      const parsed = JSON.parse(res || '[]');
      let allDevices: any[] = [];
      if (parsed.paired) allDevices = [...allDevices, ...parsed.paired];
      if (parsed.found) allDevices = [...allDevices, ...parsed.found];
      setDevices(allDevices);
    } catch (err: any) {
      Alert.alert('Gagal Pindai', err.message || 'Terjadi kesalahan');
    } finally {
      setIsScanning(false);
    }
  };

  const connectDevice = async (address: string) => {
    if (!BluetoothManager) return;
    try {
      setIsScanning(true);
      await BluetoothManager.connect(address);
      setConnectedDevice(address);
      Alert.alert('Berhasil', 'Printer berhasil terhubung');
    } catch (err: any) {
      Alert.alert('Gagal Terhubung', err.message || 'Pastikan printer menyala');
    } finally {
      setIsScanning(false);
    }
  };

  const testPrint = async () => {
    if (!BluetoothEscposPrinter) {
      Alert.alert('Info', 'Modul printer tidak tersedia');
      return;
    }
    if (!connectedDevice) {
      Alert.alert('Info', 'Harap hubungkan printer terlebih dahulu');
      return;
    }
    
    try {
      await BluetoothEscposPrinter.printerInit();
      await BluetoothEscposPrinter.printerLeftSpace(0);
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      await BluetoothEscposPrinter.setBlob(0);
      await BluetoothEscposPrinter.printText('TEST PRINT SUCCESS\n\r', { encoding: 'GBK', codepage: 0, widthtimes: 1, heigthtimes: 1, fonttype: 1 });
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
      await BluetoothEscposPrinter.printText('Printer Anda siap digunakan untuk mencetak struk voucher.\n\r', { encoding: 'GBK', codepage: 0, widthtimes: 0, heigthtimes: 0, fonttype: 1 });
      await BluetoothEscposPrinter.printText('\n\r\n\r', {});
    } catch (err: any) {
      Alert.alert('Gagal Cetak', err.message || 'Terjadi kesalahan saat mencetak');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="arrow-left" size={20} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Pengaturan Printer</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome name="bluetooth-b" size={20} color="#3b82f6" />
            <Text style={styles.cardTitle}>Printer Thermal Bluetooth</Text>
          </View>
          <Text style={styles.cardDesc}>Hubungkan aplikasi dengan printer kasir bluetooth untuk mencetak struk fisik.</Text>
          
          <TouchableOpacity 
            style={[styles.btn, isScanning && styles.btnDisabled]} 
            onPress={scanDevices}
            disabled={isScanning}
          >
            {isScanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Pindai Perangkat</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Daftar Perangkat</Text>
        
        {devices.length === 0 && !isScanning ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Tidak ada perangkat Bluetooth ditemukan.</Text>
          </View>
        ) : (
          <FlatList
            data={devices}
            keyExtractor={(item, index) => item.address || String(index)}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.deviceItem, connectedDevice === item.address && styles.deviceItemActive]}
                onPress={() => connectDevice(item.address)}
              >
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
                  <Text style={styles.deviceMac}>{item.address}</Text>
                </View>
                {connectedDevice === item.address ? (
                  <Text style={styles.statusText}>Terhubung</Text>
                ) : (
                  <FontAwesome name="chevron-right" size={16} color="#cbd5e1" />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.testBtn} onPress={testPrint} disabled={!connectedDevice && !!BluetoothManager}>
          <Text style={styles.testBtnText}>Test Print</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 8,
    marginRight: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  btn: {
    backgroundColor: '#4D44E3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: '#94a3b8',
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  deviceItemActive: {
    borderWidth: 1,
    borderColor: '#4D44E3',
    backgroundColor: '#e0e7ff',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  deviceMac: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#10b981',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  testBtn: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  testBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
