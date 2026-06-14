import React, { createContext, useState, useContext } from 'react';
import { SymbolView } from 'expo-symbols';
import { Link, Tabs, router } from 'expo-router';
import { Platform, Pressable, View, Text, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export const SearchContext = createContext<{searchQuery: string, setSearchQuery: (q: string) => void}>({ searchQuery: '', setSearchQuery: () => {} });

export function useSearch() {
  return useContext(SearchContext);
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isProfileMenuVisible, setIsProfileMenuVisible] = useState(false);

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: useClientOnlyValue(false, true),
        headerTitle: () => (
          isSearchActive ? (
            <TextInput
              autoFocus
              placeholder="Ketik untuk mencari..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, width: 200, fontSize: 16 }}
            />
          ) : null
        ),
        headerLeft: () => (
          isSearchActive ? null : (
            <View style={{ marginLeft: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#4D44E3' }}>Billing Radius</Text>
            </View>
          )
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', marginRight: 16, gap: 16, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => { setIsSearchActive(!isSearchActive); if (isSearchActive) setSearchQuery(''); }}>
              <FontAwesome name={isSearchActive ? "close" : "search"} size={20} color="#64748b" />
            </TouchableOpacity>
            {!isSearchActive && (
              <TouchableOpacity onPress={() => setIsProfileMenuVisible(true)}>
                <FontAwesome name="user-circle" size={20} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
        ),
        headerShadowVisible: false, // removes the border below header
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'square.grid.2x2', android: 'dashboard', web: 'dashboard' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="voucher"
        options={{
          title: 'Voucher',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'ticket', android: 'confirmation_number', web: 'confirmation_number' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="router"
        options={{
          title: 'PPPoE',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'wifi.router', android: 'router', web: 'router' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="member"
        options={{
          title: 'Member',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'person.2', android: 'group', web: 'group' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
    </Tabs>

      <Modal transparent visible={isProfileMenuVisible} onRequestClose={() => setIsProfileMenuVisible(false)} animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' }} onPress={() => setIsProfileMenuVisible(false)} activeOpacity={1}>
          <View style={{ position: 'absolute', top: 50, right: 16, backgroundColor: 'white', borderRadius: 8, padding: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4, minWidth: 150 }}>
            <TouchableOpacity style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }} onPress={() => { setIsProfileMenuVisible(false); router.push('/settings'); }}>
              <Text style={{ fontSize: 16, color: '#334155' }}>Pengaturan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: 12 }} onPress={() => { setIsProfileMenuVisible(false); Alert.alert('Konfirmasi', 'Apakah Anda yakin ingin logout?', [{ text: 'Batal', style: 'cancel' }, { text: 'Logout', style: 'destructive', onPress: () => Alert.alert('Info', 'Sistem login belum tersedia') }]); }}>
              <Text style={{ fontSize: 16, color: '#ef4444' }}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SearchContext.Provider>
  );
}
