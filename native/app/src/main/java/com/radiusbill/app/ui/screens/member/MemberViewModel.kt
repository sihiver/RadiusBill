package com.radiusbill.app.ui.screens.member

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.radiusbill.app.data.api.ApiClient
import com.radiusbill.app.data.model.ExtendMemberRequest
import com.radiusbill.app.data.model.Member
import com.radiusbill.app.data.model.MemberRequest
import com.radiusbill.app.data.model.PackageItem
import com.radiusbill.app.util.ThermalPrinterManager
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class MemberUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val members: List<Member> = emptyList(),
    val packages: List<PackageItem> = emptyList(),
    val message: String? = null,
    val errorMessage: String? = null
)

class MemberViewModel(application: Application) : AndroidViewModel(application) {

    private val apiService = ApiClient.getInstance(application).apiService
    val printerManager = ThermalPrinterManager(application)

    private val _uiState = MutableStateFlow(MemberUiState())
    val uiState: StateFlow<MemberUiState> = _uiState.asStateFlow()

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
                val membersDeferred = async { apiService.getMembers() }
                val packagesDeferred = async { apiService.getPackages(type = "Hotspot") }

                val membersRes = membersDeferred.await()
                val packagesRes = packagesDeferred.await()

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    members = membersRes.data ?: emptyList(),
                    packages = packagesRes.data ?: emptyList(),
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    errorMessage = e.message ?: "Gagal memuat data member."
                )
            }
        }
    }

    fun createMember(request: MemberRequest) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = apiService.createMember(request)
                if (response.success) {
                    _uiState.value = _uiState.value.copy(message = "Member berhasil ditambahkan!")
                    loadData()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = response.message ?: "Gagal menambah member."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Gagal menambah member."
                )
            }
        }
    }

    fun updateMember(id: Long, request: MemberRequest) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = apiService.updateMember(id, request)
                if (response.success) {
                    _uiState.value = _uiState.value.copy(message = "Data member berhasil diperbarui!")
                    loadData()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = response.message ?: "Gagal mengupdate member."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Gagal mengupdate member."
                )
            }
        }
    }

    fun deleteMember(id: Long) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = apiService.deleteMember(id)
                if (response.success) {
                    _uiState.value = _uiState.value.copy(message = "Member berhasil dihapus!")
                    loadData()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = response.message ?: "Gagal menghapus member."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Gagal menghapus member."
                )
            }
        }
    }

    fun extendMember(id: Long, days: Int = 30) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = apiService.extendMember(id, ExtendMemberRequest(days = days))
                if (response.success) {
                    _uiState.value = _uiState.value.copy(message = "Masa aktif member diperpanjang $days hari!")
                    loadData()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        errorMessage = response.message ?: "Gagal memperpanjang member."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Gagal memperpanjang member."
                )
            }
        }
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(message = null, errorMessage = null)
    }
}
