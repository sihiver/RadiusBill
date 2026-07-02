import { useColorScheme, Text, View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import Colors from '@/constants/Colors';
import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/services/api';
import { FontAwesome } from '@expo/vector-icons';
import { useSearch } from './_layout';

export default function ReportScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [summary, setSummary] = useState({
    revenue_this_month: 0,
    revenue_today: 0,
    active_vouchers: 0,
    active_members: 0,
    active_routers: 0,
  });
  
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  const { searchQuery } = useSearch();

  const fetchReportData = async (month: string) => {
    try {
      const [summaryRes, revenueRes] = await Promise.all([
        apiFetch(`/reports/summary?month=${month}`),
        apiFetch(`/reports/revenue?month=${month}`),
      ]);

      if (summaryRes && summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }
      if (revenueRes && revenueRes.success && revenueRes.data) {
        setRevenueData(revenueRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch report data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReportData(selectedMonth);
  }, [selectedMonth]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReportData(selectedMonth);
  };

  const getMonthList = () => {
    const list = [];
    const d = new Date();
    for (let i = 0; i < 6; i++) {
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const mm = String(monthIndex + 1).padStart(2, '0');
      const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      list.push({ value: `${year}-${mm}`, label });
      d.setMonth(d.getMonth() - 1);
    }
    return list;
  };

  const months = getMonthList();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const getTransactionIcon = (type: string) => {
    if (type?.toLowerCase() === 'voucher') return 'ticket';
    if (type?.toLowerCase() === 'member') return 'group';
    return 'exchange';
  };

  const getTransactionColor = (type: string) => {
    if (type?.toLowerCase() === 'voucher') return '#3b82f6'; // blue
    if (type?.toLowerCase() === 'member') return '#10b981'; // green
    return '#8b5cf6'; // purple
  };

  const filteredRevenue = revenueData.filter((item: any) => {
    const search = searchQuery.toLowerCase();
    const matchesDate = item.date?.includes(search);
    const matchesType = item.type?.toLowerCase().includes(search);
    return matchesDate || matchesType;
  });

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* Month Selector Slider */}
      <View style={styles.monthSelectorWrapper}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pilih Bulan</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={months}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.monthScroll}
          renderItem={({ item }) => {
            const isSelected = selectedMonth === item.value;
            return (
              <TouchableOpacity
                style={[
                  styles.monthChip,
                  {
                    backgroundColor: isSelected ? '#4D44E3' : colors.card,
                    borderColor: isSelected ? '#4D44E3' : colors.border || '#e2e8f0',
                  }
                ]}
                onPress={() => {
                  setLoading(true);
                  setSelectedMonth(item.value);
                }}
              >
                <Text style={[styles.monthChipText, { color: isSelected ? '#fff' : colors.text }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={[styles.fullSummaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Pendapatan Bulan Ini</Text>
            <FontAwesome name="calendar" size={16} color="#4D44E3" />
          </View>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {formatCurrency(Number(summary.revenue_this_month))}
          </Text>
        </View>

        <View style={[styles.halfSummaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Hari Ini</Text>
            <FontAwesome name="money" size={16} color="#10b981" />
          </View>
          <Text style={[styles.summarySubValue, { color: colors.text }]}>
            {formatCurrency(Number(summary.revenue_today))}
          </Text>
        </View>

        <View style={[styles.halfSummaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Voucher Aktif</Text>
            <FontAwesome name="ticket" size={16} color="#3b82f6" />
          </View>
          <Text style={[styles.summarySubValue, { color: colors.text }]}>
            {summary.active_vouchers}
          </Text>
        </View>

        <View style={[styles.halfSummaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Member Aktif</Text>
            <FontAwesome name="group" size={16} color="#8b5cf6" />
          </View>
          <Text style={[styles.summarySubValue, { color: colors.text }]}>
            {summary.active_members}
          </Text>
        </View>

        <View style={[styles.halfSummaryCard, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Router Online</Text>
            <FontAwesome name="wifi" size={16} color="#f59e0b" />
          </View>
          <Text style={[styles.summarySubValue, { color: colors.text }]}>
            {summary.active_routers}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Detail Transaksi Harian</Text>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    const formattedDate = new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const transType = item.type || 'Transaksi';
    
    return (
      <View style={[styles.transCard, { backgroundColor: colors.card }]}>
        <View style={styles.transLeft}>
          <View style={[styles.iconContainer, { backgroundColor: getTransactionColor(transType) + '15' }]}>
            <FontAwesome name={getTransactionIcon(transType)} size={20} color={getTransactionColor(transType)} />
          </View>
          <View style={styles.transText}>
            <Text style={[styles.transTitle, { color: colors.text }]}>
              {transType.charAt(0).toUpperCase() + transType.slice(1)}
            </Text>
            <Text style={[styles.transSubtitle, { color: colors.textSecondary }]}>
              {formattedDate} • {item.transaction_count} Transaksi
            </Text>
          </View>
        </View>
        <Text style={[styles.transAmount, { color: colors.text }]}>
          +{formatCurrency(Number(item.total_amount))}
        </Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4D44E3" />
        <Text style={{ marginTop: 10 }}>Memuat Laporan...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredRevenue}
        keyExtractor={(item, idx) => `${item.date}-${item.type}-${idx}`}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Tidak ada transaksi pada bulan ini.</Text>
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
  listContainer: {
    paddingBottom: 40,
  },
  headerSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  monthSelectorWrapper: {
    marginBottom: 16,
  },
  monthScroll: {
    gap: 8,
    paddingRight: 16,
  },
  monthChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  monthChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  fullSummaryCard: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  halfSummaryCard: {
    width: '48.4%',
    borderRadius: 12,
    padding: 16,
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
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summarySubValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  transCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  transLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transText: {
    justifyContent: 'center',
  },
  transTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  transSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  transAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
  },
});
