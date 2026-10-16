package com.radiusbill.app.ui.screens.voucher

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.radiusbill.app.data.api.ApiClient
import com.radiusbill.app.data.model.GenerateVoucherRequest
import com.radiusbill.app.data.model.PackageItem
import com.radiusbill.app.data.model.Voucher
import com.radiusbill.app.util.ThermalPrinterManager
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class VoucherUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val vouchers: List<Voucher> = emptyList(),
    val packages: List<PackageItem> = emptyList(),
    val statusFilter: String = "All", // "All", "Active", "Unused", "Expired"
    val isPrinting: Boolean = false,
    val message: String? = null,
    val errorMessage: String? = null
)

class VoucherViewModel(application: Application) : AndroidViewModel(application) {

    private val apiService = ApiClient.getInstance(application).apiService
    val printerManager = ThermalPrinterManager(application)

    private val _uiState = MutableStateFlow(VoucherUiState())
    val uiState: StateFlow<VoucherUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun setStatusFilter(filter: String) {
        _uiState.value = _uiState.value.copy(statusFilter = filter)
    }

    fun refresh() {
        _uiState.value = _uiState.value.copy(isRefreshing = true)
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            try {
                val vouchersDeferred = async { apiService.getVouchers(limit = 10000) }
                val packagesDeferred = async { apiService.getPackages(type = "Hotspot") }

                val vouchersRes = vouchersDeferred.await()
                val packagesRes = packagesDeferred.await()

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    vouchers = vouchersRes.data ?: emptyList(),
                    packages = packagesRes.data ?: emptyList(),
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    errorMessage = e.message ?: "Gagal memuat daftar voucher."
                )
            }
        }
    }

    fun generateVouchers(packageId: Long, quantity: Int, prefix: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = apiService.generateVouchers(
                    GenerateVoucherRequest(
                        packageId = packageId,
                        quantity = quantity,
                        prefix = prefix.ifBlank { null },
                        characterLength = 6
                    )
                )
                if (response.success) {
                    _uiState.value = _uiState.value.copy(message = "Berhasil membuat $quantity voucher!")
                    loadData()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = response.message ?: "Gagal generate voucher."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Gagal generate voucher."
                )
            }
        }
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(message = null, errorMessage = null)
    }
}
