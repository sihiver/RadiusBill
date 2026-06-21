import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  useColorScheme
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome } from '@expo/vector-icons';
import { BASE_URL } from '@/services/api';
import Colors from '@/constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Extract clean domain name for display (e.g. bill.mqlspot.my.id)
  const cleanDomain = BASE_URL.replace('https://', '').replace('http://', '').replace('/api', '');

  const handleLogin = async () => {
    console.log('[LOGIN] Attempting login for username:', username.trim());
    if (!username.trim() || !password.trim()) {
      console.warn('[LOGIN] Validation failed: Empty username or password');
      Alert.alert('Error', 'Username dan password wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const url = `${BASE_URL}/auth/login`;
      console.log('[LOGIN] Fetching URL:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      console.log('[LOGIN] Response status:', response.status);
      const resData = await response.json();
      console.log('[LOGIN] Response JSON:', resData);

      if (!response.ok || !resData.success) {
        throw new Error(resData.message || 'Kredensial tidak valid atau server bermasalah.');
      }

      // Save token and username to storage
      await AsyncStorage.setItem('auth_token', resData.data.token);
      await AsyncStorage.setItem('auth_username', resData.data.user.username);
      console.log('[LOGIN] Auth details stored in AsyncStorage');
      
      if (Platform.OS === 'web') {
        alert('Login berhasil!');
        router.replace('/(tabs)');
      } else {
        Alert.alert('Berhasil', 'Login berhasil!', [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/(tabs)');
            }
          }
        ]);
      }
    } catch (err: any) {
      console.error('[LOGIN ERROR]', err);
      Alert.alert('Login Gagal', err.message || 'Koneksi ke server gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <View style={[styles.logoContainer, { backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#e0e7ff' }]}>
              <FontAwesome name="lock" size={48} color="#4D44E3" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>RadiusBill</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sistem Billing Hotspot & PPPoE
            </Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.formTitle, { color: colors.text }]}>Sign In</Text>

            <View style={styles.inputWrapper}>
              <FontAwesome name="user" size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputWrapper}>
              <FontAwesome name="lock" size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity 
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginBtnText}>Masuk</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footerContainer}>
            <FontAwesome name="server" size={12} color="#94a3b8" />
            <Text style={styles.serverText}>
              Terhubung ke: <Text style={{ fontWeight: 'bold' }}>{cleanDomain}</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 46,
    paddingRight: 16,
    fontSize: 15,
  },
  loginBtn: {
    backgroundColor: '#4D44E3',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#4D44E3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  loginBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 6,
  },
  serverText: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
