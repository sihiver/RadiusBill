package com.radiusbill.app.ui.screens.report

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.radiusbill.app.data.api.ApiClient
import com.radiusbill.app.data.model.ReportSummaryData
import com.radiusbill.app.data.model.RevenueItem
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

data class MonthItem(
    val value: String, // e.g. "2026-10"
    val label: String  // e.g. "Oktober 2026"
)

data class ReportUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val selectedMonth: String = "",
    val months: List<MonthItem> = emptyList(),
    val summary: ReportSummaryData = ReportSummaryData(),
    val revenueData: List<RevenueItem> = emptyList(),
    val errorMessage: String? = null
)

class ReportViewModel(application: Application) : AndroidViewModel(application) {

    private val apiService = ApiClient.getInstance(application).apiService

    private val _uiState = MutableStateFlow(ReportUiState())
    val uiState: StateFlow<ReportUiState> = _uiState.asStateFlow()

    init {
        val monthList = generateMonthList()
        val defaultMonth = monthList.firstOrNull()?.value ?: ""
        _uiState.value = _uiState.value.copy(
            months = monthList,
            selectedMonth = defaultMonth
        )
        loadData(defaultMonth)
    }

    private fun generateMonthList(): List<MonthItem> {
        val list = mutableListOf<MonthItem>()
        val valFormat = SimpleDateFormat("yyyy-MM", Locale.getDefault())
        val labelFormat = SimpleDateFormat("MMMM yyyy", Locale("id", "ID"))

        for (i in 0 until 6) {
            val d = Calendar.getInstance()
            d.add(Calendar.MONTH, -i)
            list.add(
                MonthItem(
                    value = valFormat.format(d.time),
                    label = labelFormat.format(d.time).replaceFirstChar { it.uppercase() }
                )
            )
        }
        return list
    }

    fun selectMonth(month: String) {
        _uiState.value = _uiState.value.copy(selectedMonth = month, isLoading = true)
        loadData(month)
    }

    fun refresh() {
        _uiState.value = _uiState.value.copy(isRefreshing = true)
        loadData(_uiState.value.selectedMonth)
    }

    private fun loadData(month: String) {
        viewModelScope.launch {
            try {
                val summaryDeferred = async { apiService.getReportSummary(month = month) }
                val revenueDeferred = async { apiService.getReportRevenue(month = month) }

                val summaryRes = summaryDeferred.await()
                val revenueRes = revenueDeferred.await()

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    summary = summaryRes.data ?: ReportSummaryData(),
                    revenueData = revenueRes.data ?: emptyList(),
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    errorMessage = e.message ?: "Gagal memuat laporan keuangan."
                )
            }
        }
    }
}
