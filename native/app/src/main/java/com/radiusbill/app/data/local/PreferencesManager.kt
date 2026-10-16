package com.radiusbill.app.data.local

import android.content.Context
import android.content.SharedPreferences

class PreferencesManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREF_NAME = "radiusbill_prefs"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_AUTH_USERNAME = "auth_username"
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_PRINTER_MAC = "saved_printer_mac"
        private const val KEY_PRINTER_NAME = "saved_printer_name"

        const val DEFAULT_BASE_URL = "https://bill.mqlspot.my.id/api"
    }

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()

    var authUsername: String?
        get() = prefs.getString(KEY_AUTH_USERNAME, null)
        set(value) = prefs.edit().putString(KEY_AUTH_USERNAME, value).apply()

    var baseUrl: String
        get() = prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(value) {
            val sanitized = value.trim().removeSuffix("/")
            prefs.edit().putString(KEY_BASE_URL, sanitized).apply()
        }

    var savedPrinterMac: String?
        get() = prefs.getString(KEY_PRINTER_MAC, null)
        set(value) = prefs.edit().putString(KEY_PRINTER_MAC, value).apply()

    var savedPrinterName: String?
        get() = prefs.getString(KEY_PRINTER_NAME, null)
        set(value) = prefs.edit().putString(KEY_PRINTER_NAME, value).apply()

    val isLoggedIn: Boolean
        get() = !authToken.isNullOrBlank()

    fun clearAuth() {
        prefs.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_AUTH_USERNAME)
            .apply()
    }
}
