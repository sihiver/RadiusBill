import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// Ganti IP di bawah dengan IP komputer Anda di jaringan WiFi lokal (misal: 192.168.1.10) 
// jika Anda melakukan pengujian (*testing*) menggunakan Expo Go di HP fisik.
// 10.0.2.2 adalah IP bawaan jika menggunakan Android Studio Emulator.
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://bill.mqlspot.my.id/api';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const url = `${BASE_URL}${endpoint}`;
    
    const token = await AsyncStorage.getItem('auth_token');
    
    // Jika token tidak ada dan bukan endpoint autentikasi, tolak request dan arahkan ke login
    if (!token && !endpoint.includes('/auth/')) {
      console.warn(`[API BLOCK] ${endpoint}: No token available. Redirecting to login...`);
      setTimeout(() => {
        router.replace('/login');
      }, 100);
      return { success: false, data: [], message: 'Unauthorized: No token provided' };
    }

    console.log(`[API CALL] ${options.method || 'GET'} ${url}`);

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    } as Record<string, string>;

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        console.warn(`[API 401] ${endpoint}: Unauthorized. Clearing token and redirecting to login...`);
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('auth_username');
        setTimeout(() => {
          router.replace('/login');
        }, 100);
        return { success: false, data: [], message: 'Unauthorized: Session expired' };
      }
      throw new Error(data.message || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error(`[API ERROR] ${endpoint}:`, error);
    throw error;
  }
};
