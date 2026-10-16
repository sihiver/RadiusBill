package com.radiusbill.app.ui.screens.router

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.radiusbill.app.data.api.ApiClient
import com.radiusbill.app.data.model.ExtendRouterRequest
import com.radiusbill.app.data.model.IsolirRequest
import com.radiusbill.app.data.model.PackageItem
import com.radiusbill.app.data.model.RouterClient
import com.radiusbill.app.data.model.RouterClientRequest
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class RouterUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val routers: List<RouterClient> = emptyList(),
    val packages: List<PackageItem> = emptyList(),
    val message: String? = null,
    val errorMessage: String? = null
)

class RouterViewModel(application: Application) : AndroidViewModel(application) {

    private val apiService = ApiClient.getInstance(application).apiService

    private val _uiState = MutableStateFlow(RouterUiState())
    val uiState: StateFlow<RouterUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    fun refresh() {
        _uiState.value = _uiState.value.copy(isRefreshing = true)
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            try {
                val routersDeferred = async { apiService.getRouters() }
                val packagesDeferred = async { apiService.getPackages(type = "PPPoE") }

                val routersRes = routersDeferred.await()
                val packagesRes = packagesDeferred.await()

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    routers = routersRes.data ?: emptyList(),
                    packages = packagesRes.data ?: emptyList(),
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    errorMessage = e.message ?: "Gagal memuat data router PPPoE."
                )
            }
        }
    }

    fun createRouter(request: RouterClientRequest) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = apiService.createRouter(request)
                if (response.success) {
                    _uiState.value = _uiState.value.copy(message = "Router PPPoE berhasil ditambahkan!")
                    loadData()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = response.message ?: "Gagal menambah router."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Gagal menambah router."
                )
            }
        }
    }

    fun updateRouter(id: Long, request: RouterClientRequest) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = apiService.updateRouter(id, request)
                if (response.success) {
                    _uiState.value = _uiState.value.copy(message = "Data router berhasil diperbarui!")
                    loadData()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = response.message ?: "Gagal mengupdate router."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Gagal mengupdate router."
                )
            }
        }
    }

    fun deleteRouter(id: Long) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = apiService.deleteRouter(id)
                if (response.success) {
                    _uiState.value = _uiState.value.copy(message = "Router berhasil dihapus!")
                    loadData()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = response.message ?: "Gagal menghapus router."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Gagal menghapus router."
                )
            }
        }
    }

    fun extendRouter(id: Long, days: Int = 30) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = apiService.extendRouter(id, ExtendRouterRequest(days = days))
                if (response.success) {
                    _uiState.value = _uiState.value.copy(message = "Masa aktif router diperpanjang $days hari!")
                    loadData()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = response.message ?: "Gagal memperpanjang masa aktif."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Gagal memperpanjang masa aktif."
                )
            }
        }
    }

    fun toggleIsolir(item: RouterClient) {
        val action = if (item.isolir) "unisolir" else "isolir"
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = apiService.toggleIsolir(
                    id = item.id,
                    action = action,
                    request = IsolirRequest(reason = "Tunggakan pembayaran")
                )
                if (response.success) {
                    val statusText = if (item.isolir) "dibuka isolirnya" else "berhasil diisolir"
                    _uiState.value = _uiState.value.copy(message = "Router $statusText!")
                    loadData()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = response.message ?: "Gagal mengubah status isolir."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Gagal mengubah status isolir."
                )
            }
        }
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(message = null, errorMessage = null)
    }
}
