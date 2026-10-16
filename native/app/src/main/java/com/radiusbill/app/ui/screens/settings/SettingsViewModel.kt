package com.radiusbill.app.ui.screens.settings

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.radiusbill.app.data.local.PreferencesManager
import com.radiusbill.app.util.BluetoothDeviceInfo
import com.radiusbill.app.util.ThermalPrinterManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SettingsUiState(
    val serverBaseUrl: String = "",
    val isScanning: Boolean = false,
    val isConnecting: Boolean = false,
    val connectedDeviceMac: String? = null,
    val connectedDeviceName: String? = null,
    val devices: List<BluetoothDeviceInfo> = emptyList(),
    val message: String? = null,
    val errorMessage: String? = null
)

class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = PreferencesManager(application)
    val printerManager = ThermalPrinterManager(application)

    private val _uiState = MutableStateFlow(
        SettingsUiState(
            serverBaseUrl = prefs.baseUrl,
            connectedDeviceMac = prefs.savedPrinterMac,
            connectedDeviceName = prefs.savedPrinterName
        )
    )
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadPairedDevices()
    }

    fun loadPairedDevices() {
        val paired = printerManager.getPairedDevices()
        _uiState.value = _uiState.value.copy(
            devices = paired,
            connectedDeviceMac = prefs.savedPrinterMac,
            connectedDeviceName = prefs.savedPrinterName
        )
    }

    fun connectPrinter(device: BluetoothDeviceInfo) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isConnecting = true, errorMessage = null)
            val result = printerManager.connect(device.macAddress)
            if (result.isSuccess) {
                _uiState.value = _uiState.value.copy(
                    isConnecting = false,
                    connectedDeviceMac = device.macAddress,
                    connectedDeviceName = device.name,
                    message = "Printer ${device.name} berhasil terhubung!"
                )
            } else {
                _uiState.value = _uiState.value.copy(
                    isConnecting = false,
                    errorMessage = result.exceptionOrNull()?.message ?: "Gagal menghubungkan printer."
                )
            }
        }
    }

    fun disconnectPrinter() {
        viewModelScope.launch {
            printerManager.disconnect()
            prefs.savedPrinterMac = null
            prefs.savedPrinterName = null
            _uiState.value = _uiState.value.copy(
                connectedDeviceMac = null,
                connectedDeviceName = null,
                message = "Printer diputuskan."
            )
        }
    }

    fun testPrint() {
        viewModelScope.launch {
            val result = printerManager.printTest()
            if (result.isSuccess) {
                _uiState.value = _uiState.value.copy(message = "Struk uji coba berhasil dicetak!")
            } else {
                _uiState.value = _uiState.value.copy(
                    errorMessage = result.exceptionOrNull()?.message ?: "Gagal melakukan tes cetak."
                )
            }
        }
    }

    fun updateServerUrl(url: String) {
        val trimmed = url.trim()
        if (trimmed.isNotBlank()) {
            prefs.baseUrl = trimmed
            _uiState.value = _uiState.value.copy(
                serverBaseUrl = prefs.baseUrl,
                message = "Alamat server berhasil disimpan!"
            )
        }
    }

    fun resetServerUrl() {
        prefs.baseUrl = PreferencesManager.DEFAULT_BASE_URL
        _uiState.value = _uiState.value.copy(
            serverBaseUrl = PreferencesManager.DEFAULT_BASE_URL,
            message = "Alamat server direset ke default!"
        )
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(message = null, errorMessage = null)
    }
}
