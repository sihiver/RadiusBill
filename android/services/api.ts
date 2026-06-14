// android/services/api.ts

// Ganti IP di bawah dengan IP komputer Anda di jaringan WiFi lokal (misal: 192.168.1.10) 
// jika Anda melakukan pengujian (*testing*) menggunakan Expo Go di HP fisik.
// 10.0.2.2 adalah IP bawaan jika menggunakan Android Studio Emulator.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.15.131:3001/api';

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`[API CALL] ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error(`[API ERROR] ${endpoint}:`, error);
    throw error;
  }
};
