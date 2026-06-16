import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, useColorScheme, Text, View, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
import Colors from '@/constants/Colors';
import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';

// In Expo Go, native modules might not be available
let BLEPrinter: any = null;


try {
  const printer = require('react-native-thermal-receipt-printer-image-qr');
  BLEPrinter = printer.BLEPrinter;
  
} catch (error) {
  console.log('Bluetooth printing module not available in this environment');
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);

  const requestBluetoothPermission = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        return (
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  };

  useEffect(() => {
        const setupPrinter = async () => {
      if (BLEPrinter) {
        const hasPerm = await requestBluetoothPermission();
        if (!hasPerm) {
          console.log('Bluetooth permissions denied');
          return;
        }
        try {
          await BLEPrinter.init();
          loadPairedDevices();
          const savedPrinter = await AsyncStorage.getItem('saved_printer');
          if (savedPrinter) {
            setConnectedDevice(savedPrinter);
          }
        } catch (e) {
          console.log('Init error:', e);
        }
      }
    };
    setupPrinter();
  }, []);

  const loadPairedDevices = async () => {
    try {
      const devices = await BLEPrinter.getDeviceList();
      if (devices && devices.length > 0) {
        setDevices(devices);
      }
    } catch (e: any) {
      console.log('Enable bluetooth failed:', e);
    }
  };

  
  
  const scanDevices = async () => {
    const hasPerm = await requestBluetoothPermission();
    if (!hasPerm) {
      Alert.alert("Izin Ditolak", "Izin Bluetooth diperlukan untuk mencari perangkat.");
      return;
    }
    if (!BLEPrinter) {
      Alert.alert('Info', 'Fitur Bluetooth tidak didukung pada Expo Go. Gunakan Development Build (APK).');
      return;
    }
    setIsScanning(true);
    setDevices([]);
    try {
      const devicesList = await BLEPrinter.getDeviceList();
      setDevices(devicesList || []);
    } catch (err: any) {
      Alert.alert('Gagal Pindai', err.message || 'Terjadi kesalahan');
    } finally {
      setIsScanning(false);
    }
  };

    const connectDevice = async (address: string) => {
    if (!BLEPrinter) return;
    try {
      setIsScanning(true);
      await BLEPrinter.connectPrinter(address);
      setConnectedDevice(address);
      await AsyncStorage.setItem('saved_printer', address);
      Alert.alert('Berhasil', 'Printer berhasil terhubung');
    } catch (err: any) {
      Alert.alert('Gagal Terhubung', err.message || 'Pastikan printer menyala');
    } finally {
      setIsScanning(false);
    }
  };

  const testPrint = async () => {
    if (!BLEPrinter) {
      Alert.alert('Info', 'Modul printer tidak tersedia');
      return;
    }
    if (!connectedDevice) {
      Alert.alert('Info', 'Harap hubungkan printer terlebih dahulu');
      return;
    }
    
    try {
      BLEPrinter.printBill('TEST PRINT SUCCESS\nPrinter Anda siap digunakan untuk mencetak struk voucher.\n\n');
    } catch (err: any) {
      Alert.alert('Gagal Cetak', err.message || 'Terjadi kesalahan saat mencetak');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Pengaturan Printer</Text>
      </View>

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <FontAwesome name="bluetooth-b" size={20} color="#3b82f6" />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Printer Thermal Bluetooth</Text>
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
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Text style={styles.emptyText}>Tidak ada perangkat Bluetooth ditemukan.</Text>
          </View>
        ) : (
          <FlatList
            data={devices}
            keyExtractor={(item, index) => item.inner_mac_address || String(index)}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.deviceItem, { backgroundColor: colors.card }, connectedDevice === item.inner_mac_address && [styles.deviceItemActive, { backgroundColor: colorScheme === 'dark' ? '#312e81' : '#e0e7ff' }]]}
                onPress={() => connectDevice(item.inner_mac_address)}
              >
                <View style={styles.deviceInfo}>
                  <Text style={[styles.deviceName, { color: colors.text }]}>{item.device_name || 'Unknown Device'}</Text>
                  <Text style={[styles.deviceMac, { color: colors.textSecondary }]}>{item.inner_mac_address}</Text>
                </View>
                {connectedDevice === item.inner_mac_address ? (
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

        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.testBtn} onPress={testPrint} disabled={!connectedDevice && !!BLEPrinter}>
            <Text style={styles.testBtnText}>Test Print</Text>
          </TouchableOpacity>
        </View>
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
