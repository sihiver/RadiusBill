import { 
  useColorScheme, 
  Text, 
  View, 
  StyleSheet, 
  FlatList, 
  RefreshControl, 
  ActivityIndicator, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  Alert 
} from 'react-native';
import Colors from '@/constants/Colors';
import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/services/api';
import { Picker } from '@react-native-picker/picker';
import { useSearch } from './_layout';

export default function RouterScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [routers, setRouters] = useState([]);
  const [packages, setPackages] = useState<any[]>([]);
  const { searchQuery } = useSearch();

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    customer_name: '',
    pppoe_user: '',
    pppoe_pass: '',
    router_ip: '',
    package_id: '',
    package_name: '',
  });

  const fetchRouters = async () => {
    try {
      const [routersRes, packagesRes] = await Promise.all([
        apiFetch('/routers'),
        apiFetch('/packages?type=PPPoE')
      ]);
      setRouters(routersRes.data || []);
      setPackages(packagesRes.data || []);
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

  const openAddModal = () => {
    setFormData({ 
      id: null, 
      customer_name: '', 
      pppoe_user: '', 
      pppoe_pass: '', 
      router_ip: '', 
      package_id: '', 
      package_name: '' 
    });
    setModalVisible(true);
  };

  const openEditModal = (routerData: any) => {
    setFormData({
      id: routerData.id,
      customer_name: routerData.customer_name || '',
      pppoe_user: routerData.pppoe_user || '',
      pppoe_pass: routerData.pppoe_pass || '',
      router_ip: routerData.router_ip || '',
      package_id: routerData.package_id || '',
      package_name: routerData.package_name || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.customer_name || !formData.pppoe_user || !formData.pppoe_pass) {
      Alert.alert('Error', 'Nama Pelanggan, Username PPPoE, dan Password wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const method = formData.id ? 'PUT' : 'POST';
      const endpoint = formData.id ? `/routers/${formData.id}` : '/routers';
      
      const selectedPkg = packages.find(p => String(p.id) === String(formData.package_id));
      const payload = {
        ...formData,
        package_name: selectedPkg ? selectedPkg.name : '',
        package_id: formData.package_id ? parseInt(formData.package_id) : null,
      };

      await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setModalVisible(false);
      fetchRouters();
    } catch (error: any) {
      Alert.alert('Gagal', error.message || 'Gagal menyimpan data router');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Konfirmasi', `Yakin ingin menghapus router pelanggan "${name}"?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        try {
          await apiFetch(`/routers/${id}`, { method: 'DELETE' });
          fetchRouters();
        } catch (error: any) {
          Alert.alert('Gagal', error.message || 'Gagal menghapus router');
        }
      }}
    ]);
  };

  const handleExtend = (id: number, name: string) => {
    Alert.alert('Perpanjang', `Perpanjang masa aktif router "${name}" (30 hari)?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Perpanjang', onPress: async () => {
        try {
          await apiFetch(`/routers/${id}/extend`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: 30 })
          });
          fetchRouters();
        } catch (error: any) {
          Alert.alert('Gagal', error.message || 'Gagal memperpanjang masa aktif');
        }
      }}
    ]);
  };

  const handleToggleIsolir = (item: any) => {
    const action = item.isolir ? 'unisolir' : 'isolir';
    const actionTitle = item.isolir ? 'Buka Isolir' : 'Isolir';
    const actionMsg = item.isolir ? `Buka isolir untuk pelanggan "${item.customer_name}"?` : `Isolir router pelanggan "${item.customer_name}"?`;

    Alert.alert(actionTitle, actionMsg, [
      { text: 'Batal', style: 'cancel' },
      { text: actionTitle, onPress: async () => {
        try {
          await apiFetch(`/routers/${item.id}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Tunggakan pembayaran' })
          });
          fetchRouters();
        } catch (error: any) {
          Alert.alert('Gagal', error.message || `Gagal memproses ${actionTitle}`);
        }
      }}
    ]);
  };

  const getStatusColor = (status: string, isolir: boolean) => {
    if (isolir || status === 'Isolated') return '#f59e0b'; // orange (Isolated)
    if (status === 'Online') return '#10b981'; // green
    return '#ef4444'; // red (Offline)
  };

  const getStatusText = (status: string, isolir: boolean) => {
    if (isolir || status === 'Isolated') return 'Isolated';
    return status || 'Offline';
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
        
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status, item.isolir) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status, item.isolir) }]}>
            {getStatusText(item.status, item.isolir)}
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
          <Text style={[styles.label, { color: colors.textSecondary }]}>Password PPPoE:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.pppoe_pass || '-'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Tgl Kedaluwarsa:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '-'}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colorScheme === 'dark' ? '#334155' : '#f1f5f9' }]} onPress={() => openEditModal(item)}>
          <Text style={styles.actionBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: item.isolir ? '#10b981' : '#f59e0b' }]} onPress={() => handleToggleIsolir(item)}>
          <Text style={[styles.actionBtnText, { color: '#fff' }]}>{item.isolir ? 'Buka Isolir' : 'Isolir'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4D44E3' }]} onPress={() => handleExtend(item.id, item.customer_name)}>
          <Text style={[styles.actionBtnText, { color: '#fff' }]}>Perpanjang</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colorScheme === 'dark' ? '#334155' : '#f1f5f9' }]} onPress={() => handleDelete(item.id, item.customer_name)}>
          <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Hapus</Text>
        </TouchableOpacity>
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
      <View style={styles.searchContainer}>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Text style={styles.addBtnText}>+ Tambah Router</Text>
        </TouchableOpacity>
      </View>

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
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{formData.id ? 'Edit Router PPPoE' : 'Tambah Router PPPoE'}</Text>
            
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              placeholder="Nama Pelanggan"
              value={formData.customer_name}
              onChangeText={(text) => setFormData({...formData, customer_name: text})}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              placeholder="Username PPPoE"
              value={formData.pppoe_user}
              onChangeText={(text) => setFormData({...formData, pppoe_user: text})}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              placeholder="Password PPPoE"
              value={formData.pppoe_pass}
              onChangeText={(text) => setFormData({...formData, pppoe_pass: text})}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              placeholder="IP Router (Opsional)"
              value={formData.router_ip}
              onChangeText={(text) => setFormData({...formData, router_ip: text})}
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Pilih Paket:</Text>
            <View style={[styles.pickerContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Picker
                selectedValue={formData.package_id}
                onValueChange={(itemValue) => setFormData({...formData, package_id: itemValue})}
                style={[styles.picker, { color: colors.text }]}
                dropdownIconColor={colors.text}
              >
                <Picker.Item label="-- Pilih Paket PPPoE --" value="" color={colors.text} style={{ backgroundColor: colors.card, color: colors.text }} />
                {packages.map((pkg: any) => (
                  <Picker.Item key={pkg.id} label={`${pkg.name} (Rp ${pkg.price})`} value={pkg.id} color={colors.text} style={{ backgroundColor: colors.card, color: colors.text }} />
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
