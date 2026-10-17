package com.radiusbill.app.ui.screens.voucher

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.radiusbill.app.data.api.ApiClient
import com.radiusbill.app.data.model.GenerateVoucherRequest
import com.radiusbill.app.data.model.PackageItem
import com.radiusbill.app.data.model.UpdateVoucherRequest
import com.radiusbill.app.data.model.Voucher
import com.radiusbill.app.util.ThermalPrinterManager
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class VoucherUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val isLoadingMore: Boolean = false,
    val hasMore: Boolean = true,
    val currentPage: Int = 1,
    val totalCount: Int = 0,
    val vouchers: List<Voucher> = emptyList(),
    val packages: List<PackageItem> = emptyList(),
    val statusFilter: String = "All", // "All", "Active", "Unused", "Expired"
    val searchQuery: String = "",
    val isPrinting: Boolean = false,
    val message: String? = null,
    val errorMessage: String? = null
)

class VoucherViewModel(application: Application) : AndroidViewModel(application) {

    private val apiService = ApiClient.getInstance(application).apiService
    val printerManager = ThermalPrinterManager(application)

    private val _uiState = MutableStateFlow(VoucherUiState())
    val uiState: StateFlow<VoucherUiState> = _uiState.asStateFlow()

    private val pageSize = 25
    private var loadJob: Job? = null
    private var searchJob: Job? = null

    init {
        loadInitialData()
    }

    fun setStatusFilter(filter: String) {
        if (_uiState.value.statusFilter == filter) return
        _uiState.value = _uiState.value.copy(
            statusFilter = filter,
            currentPage = 1,
            hasMore = true,
            isLoading = true,
            vouchers = emptyList()
        )
        loadVouchers(page = 1)
    }

    fun onSearchQueryChanged(query: String) {
        if (_uiState.value.searchQuery == query) return
        _uiState.value = _uiState.value.copy(searchQuery = query)

        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(350)
            _uiState.value = _uiState.value.copy(
                currentPage = 1,
                hasMore = true,
                isLoading = true,
                vouchers = emptyList()
            )
            loadVouchers(page = 1)
        }
    }

    fun refresh() {
        _uiState.value = _uiState.value.copy(
            isRefreshing = true,
            currentPage = 1,
            hasMore = true
        )
        loadInitialData(isRefresh = true)
    }

    fun loadMore() {
        val state = _uiState.value
        if (state.isLoading || state.isLoadingMore || !state.hasMore) return

        val nextPage = state.currentPage + 1
        _uiState.value = state.copy(isLoadingMore = true)
        loadVouchers(page = nextPage)
    }

    private fun loadInitialData(isRefresh: Boolean = false) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            try {
                val packagesDeferred = if (_uiState.value.packages.isEmpty() || isRefresh) {
                    async { runCatching { apiService.getPackages(type = "Hotspot") }.getOrNull() }
                } else null

                val filter = _uiState.value.statusFilter
                val query = _uiState.value.searchQuery.trim().ifBlank { null }
                val vouchersDeferred = async { fetchVouchersFromApi(page = 1, filter = filter, query = query) }

                val pkgRes = packagesDeferred?.await()
                val (vouchersList, total) = vouchersDeferred.await()

                val newPackages = pkgRes?.data ?: _uiState.value.packages
                val hasMoreItems = vouchersList.size >= pageSize && vouchersList.size < total

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    isLoadingMore = false,
                    vouchers = vouchersList,
                    packages = newPackages,
                    currentPage = 1,
                    totalCount = total,
                    hasMore = hasMoreItems,
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    isLoadingMore = false,
                    errorMessage = e.message ?: "Gagal memuat data voucher."
                )
            }
        }
    }

    private fun loadVouchers(page: Int) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            try {
                val filter = _uiState.value.statusFilter
                val query = _uiState.value.searchQuery.trim().ifBlank { null }
                val (newVouchers, total) = fetchVouchersFromApi(page = page, filter = filter, query = query)

                val updatedList = if (page == 1) {
                    newVouchers
                } else {
                    val existingIds = _uiState.value.vouchers.map { it.id }.toSet()
                    _uiState.value.vouchers + newVouchers.filter { it.id !in existingIds }
                }

                val hasMoreItems = newVouchers.size >= pageSize && updatedList.size < total

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    isLoadingMore = false,
                    vouchers = updatedList,
                    currentPage = page,
                    totalCount = if (total > 0) total else updatedList.size,
                    hasMore = hasMoreItems,
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    isLoadingMore = false,
                    errorMessage = e.message ?: "Gagal memuat voucher berikutnya."
                )
            }
        }
    }

    private suspend fun fetchVouchersFromApi(page: Int, filter: String, query: String?): Pair<List<Voucher>, Int> {
        return if (filter.equals("Expired", ignoreCase = true)) {
            try {
                val logsRes = apiService.getVoucherLogs(page = page, limit = pageSize, query = query)
                val list = logsRes.data ?: emptyList()
                val total = logsRes.pagination?.total ?: list.size
                if (list.isNotEmpty()) {
                    Pair(list, total)
                } else {
                    val fallback = apiService.getVouchers(page = page, limit = pageSize, status = "Expired", query = query)
                    Pair(fallback.data ?: emptyList(), fallback.pagination?.total ?: 0)
                }
            } catch (e: Exception) {
                val fallback = apiService.getVouchers(page = page, limit = pageSize, status = "Expired", query = query)
                Pair(fallback.data ?: emptyList(), fallback.pagination?.total ?: 0)
            }
        } else {
            val statusParam = if (filter == "All") null else filter
            val res = apiService.getVouchers(page = page, limit = pageSize, status = statusParam, query = query)
            val list = res.data ?: emptyList()
            val total = res.pagination?.total ?: list.size
            Pair(list, total)
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
                    loadVouchers(page = 1)
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

    fun updateVoucherMac(voucher: Voucher, newMac: String?) {
        viewModelScope.launch {
            try {
                val formattedMac = newMac?.trim()?.ifBlank { null }
                val request = UpdateVoucherRequest(macAddress = formattedMac)
                val targetId = voucher.originalId ?: voucher.id
                val response = if (!voucher.expiredAt.isNullOrBlank() || !voucher.expireReason.isNullOrBlank()) {
                    apiService.updateVoucherLog(voucher.id, request)
                } else {
                    apiService.updateVoucher(targetId, request)
                }
                _uiState.value = _uiState.value.copy(
                    message = response.message ?: "MAC address voucher berhasil diperbarui"
                )
                refresh()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    errorMessage = e.message ?: "Gagal memperbarui MAC address"
                )
            }
        }
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(message = null, errorMessage = null)
    }
}
