import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, TextInput, Modal, Alert, Share } from 'react-native';
import { Text, View } from '@/components/Themed';
import { apiFetch } from '@/services/api';
import { Picker } from '@react-native-picker/picker';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useSearch } from './_layout';

let BluetoothEscposPrinter: any = null;
try {
  const printer = require('react-native-thermal-receipt-printer-image-qr');
  BluetoothEscposPrinter = printer.BluetoothEscposPrinter;
} catch (error) {
  // Ignore in Expo Go
}

export default function MemberScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState([]);
  const [packages, setPackages] = useState([]);
  const { searchQuery } = useSearch();
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    username: '',
    password: '',
    phone: '',
    package_id: '',
  });

  const fetchData = async () => {
    try {
      const [membersRes, packagesRes] = await Promise.all([
        apiFetch('/members'),
        apiFetch('/packages?type=Hotspot')
      ]);
      setMembers(membersRes.data || []);
      setPackages(packagesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openAddModal = () => {
    setFormData({ id: null, name: '', username: '', password: '', phone: '', package_id: '' });
    setModalVisible(true);
  };

  const openEditModal = (member: any) => {
    setFormData({
      id: member.id,
      name: member.name || '',
      username: member.username || '',
      password: '', // do not fill password
      phone: member.phone || '',
      package_id: member.package_id || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.username) {
      Alert.alert('Error', 'Nama dan Username wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const method = formData.id ? 'PUT' : 'POST';
      const endpoint = formData.id ? `/members/${formData.id}` : '/members';
      
      const payload: any = { ...formData };
      if (formData.id && !payload.password) {
        delete payload.password; // dont send empty password on update
      }

      await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setModalVisible(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Gagal', error.message || 'Gagal menyimpan member');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Konfirmasi', 'Yakin ingin menghapus member ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try {
          await apiFetch(`/members/${id}`, { method: 'DELETE' });
          fetchData();
        } catch (error: any) {
          Alert.alert('Gagal', error.message || 'Gagal menghapus member');
        }
      }}
    ]);
  };

  const handleExtend = (id: number) => {
    Alert.alert('Perpanjang', 'Perpanjang masa aktif member ini (30 hari)?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Perpanjang', onPress: async () => {
        try {
          await apiFetch(`/members/${id}/extend`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: 30 })
          });
          fetchData();
        } catch (error: any) {
          Alert.alert('Gagal', error.message || 'Gagal memperpanjang member');
        }
      }}
    ]);
  };

  const handleShare = async (item: any) => {
    try {
      const message = `Halo ${item.name || ''},\nBerikut adalah detail login WiFi Anda:\n\nUsername: ${item.username}\nPassword: ${item.password || '******'}\nPaket: ${item.package_name || '-'}\n\nTerima kasih.`;
      await Share.share({ message });
    } catch (error) {
      console.error(error);
    }
  };

  const handlePrint = async (item: any) => {
    try {
      if (BluetoothEscposPrinter) {
        try {
          await BluetoothEscposPrinter.printerInit();
          await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
          await BluetoothEscposPrinter.printText('BILLING RADIUS\n\r', { fonttype: 1 });
          await BluetoothEscposPrinter.printText('--------------------------------\n\r', {});
          await BluetoothEscposPrinter.printText('Akun Member PPPoE\n\r', {});
          await BluetoothEscposPrinter.printText('--------------------------------\n\r', {});
          await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
          await BluetoothEscposPrinter.printText(`Nama : ${item.name}\n\r`, {});
          await BluetoothEscposPrinter.printText(`User : ${item.username}\n\r`, {});
          await BluetoothEscposPrinter.printText(`Pass : ${item.password || '***'}\n\r`, {});
          await BluetoothEscposPrinter.printText(`Paket: ${item.package_name || '-'}\n\r`, {});
          await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
          await BluetoothEscposPrinter.printText('--------------------------------\n\r', {});
          await BluetoothEscposPrinter.printText('Simpan info akun ini dengan baik\n\r', { fonttype: 1 });
          await BluetoothEscposPrinter.printText('\n\r\n\r', {});
          Alert.alert('Sukses', 'Detail member berhasil dicetak ke printer Bluetooth');
          return;
        } catch (printErr: any) {
          console.log('Bluetooth print failed, falling back to PDF', printErr);
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
              h3 { font-size: 14px; margin: 5px 0; }
              p { margin: 5px 0; }
              .dashed-line { border-top: 1px dashed #000; margin: 10px 0; }
              .info-row { display: flex; justify-content: space-between; text-align: left; font-size: 12px; margin-bottom: 2px;}
            </style>
          </head>
          <body>
            <h2>BILLING RADIUS</h2>
            <div class="dashed-line"></div>
            <p>Akun Member PPPoE</p>
            
            <div class="dashed-line"></div>
            <div class="info-row"><span>Nama:</span> <b>${item.name}</b></div>
            <div class="info-row"><span>User:</span> <b>${item.username}</b></div>
            <div class="info-row"><span>Pass:</span> <b>${item.password || '***'}</b></div>
            <div class="info-row"><span>Paket:</span> <b>${item.package_name || '-'}</b></div>
            
            <div class="dashed-line"></div>
            <p style="font-size: 10px;">Simpan informasi akun ini dengan baik.</p>
          </body>
        </html>
      `;
      await Print.printAsync({ html });
    } catch (error) {
      console.error(error);
      Alert.alert('Gagal', 'Tidak dapat memproses printer');
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'Active') return '#10b981'; // green
    if (status === 'Expired') return '#ef4444'; // red
    if (status === 'Suspended') return '#f59e0b'; // orange
    return '#64748b';
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.substring(0, 1).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={[styles.nameText, { color: colors.text }]}>{item.name}</Text>
            <Text style={styles.phoneText}>{item.phone || 'No HP Belum Diisi'}</Text>
          </View>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Username:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.username}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Password:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.password || '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Paket Aktif:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.package_name || '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Tgl Kedaluwarsa:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '-'}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(item)}>
          <Text style={styles.actionBtnText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handlePrint(item)}>
          <Text style={styles.actionBtnText}>Print</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}>
          <Text style={styles.actionBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#10b981'}]} onPress={() => handleExtend(item.id)}>
          <Text style={[styles.actionBtnText, {color: '#fff'}]}>Perpanjang</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
          <Text style={[styles.actionBtnText, {color: '#ef4444'}]}>Hapus</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4D44E3" />
        <Text style={{ marginTop: 10 }}>Memuat Data Member...</Text>
      </View>
    );
  }

  const filteredMembers = members.filter((m: any) => 
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.phone?.includes(searchQuery)
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>Manajemen Member</Text>
      <View style={styles.searchContainer}>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Text style={styles.addBtnText}>+ Tambah Member</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Tidak ada data member.</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{formData.id ? 'Edit Member' : 'Tambah Member'}</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nama Lengkap"
              value={formData.name}
              onChangeText={(text) => setFormData({...formData, name: text})}
            />
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={formData.username}
              onChangeText={(text) => setFormData({...formData, username: text})}
            />
            <TextInput
              style={styles.input}
              placeholder={formData.id ? "Password (Kosongkan jika tidak diubah)" : "Password"}
              secureTextEntry
              value={formData.password}
              onChangeText={(text) => setFormData({...formData, password: text})}
            />
            <TextInput
              style={styles.input}
              placeholder="No. HP"
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(text) => setFormData({...formData, phone: text})}
            />

            <Text style={styles.pickerLabel}>Pilih Paket:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.package_id}
                onValueChange={(itemValue) => setFormData({...formData, package_id: itemValue})}
                style={styles.picker}
              >
                <Picker.Item label="-- Pilih Paket --" value="" />
                {packages.map((pkg: any) => (
                  <Picker.Item key={pkg.id} label={`${pkg.name} (Rp ${pkg.price})`} value={pkg.id} />
                ))}
              </Picker>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.modalSaveText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: 'transparent',
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
  },
  addBtn: {
    backgroundColor: '#4D44E3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: 'bold',
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1e293b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  pickerLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    marginBottom: 20,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    backgroundColor: 'transparent',
  },
  modalCancelBtn: {
    padding: 12,
  },
  modalCancelText: {
    color: '#64748b',
    fontWeight: 'bold',
  },
  modalSaveBtn: {
    backgroundColor: '#4D44E3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
