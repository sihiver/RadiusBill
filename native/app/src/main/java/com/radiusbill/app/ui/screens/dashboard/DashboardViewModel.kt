package com.radiusbill.app.ui.screens.dashboard

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.radiusbill.app.data.api.ApiClient
import com.radiusbill.app.data.model.RadiusLogRaw
import com.radiusbill.app.data.model.RevenueTrendItem
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class ChartBarData(
    val dayName: String,
    val dateStr: String,
    val amount: Double
)

data class DashboardUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val voucherCount: Int = 0,
    val memberCount: Int = 0,
    val routerCount: Int = 0,
    val revenueThisMonth: Double = 0.0,
    val onlineUsers: Int = 0,
    val chartData: List<ChartBarData> = emptyList(),
    val logs: List<RadiusLogRaw> = emptyList(),
    val errorMessage: String? = null
)

class DashboardViewModel(application: Application) : AndroidViewModel(application) {

    private val apiService = ApiClient.getInstance(application).apiService

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboardData()
    }

    fun refresh() {
        _uiState.value = _uiState.value.copy(isRefreshing = true)
        loadDashboardData()
    }

    private fun loadDashboardData() {
        viewModelScope.launch {
            try {
                val vouchersDeferred = async { runCatching { apiService.getVouchers() }.getOrNull() }
                val membersDeferred = async { runCatching { apiService.getMembers() }.getOrNull() }
                val routersDeferred = async { runCatching { apiService.getRouters() }.getOrNull() }
                val statsDeferred = async { runCatching { apiService.getDashboardStats() }.getOrNull() }
                val logsDeferred = async { runCatching { apiService.getRadiusLogs(limit = 15) }.getOrNull() }

                val vouchersRes = vouchersDeferred.await()
                val membersRes = membersDeferred.await()
                val routersRes = routersDeferred.await()
                val statsRes = statsDeferred.await()
                val logsRes = logsDeferred.await()

                val vCount = vouchersRes?.data?.size ?: 0
                val mCount = membersRes?.data?.size ?: 0
                val rCount = routersRes?.data?.size ?: 0

                val statsData = statsRes?.data
                val revenueMonth = statsData?.revenue?.thisMonth ?: 0.0
                val onlineUsers = statsData?.sessions?.activeSessions?.toIntOrNull() ?: 0

                val chartBars = generateChartData(statsData?.revenueTrend ?: emptyList())
                val logsList = logsRes?.data ?: emptyList()

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    voucherCount = vCount,
                    memberCount = mCount,
                    routerCount = rCount,
                    revenueThisMonth = revenueMonth,
                    onlineUsers = onlineUsers,
                    chartData = chartBars,
                    logs = logsList,
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isRefreshing = false,
                    errorMessage = e.message ?: "Gagal memuat data dashboard."
                )
            }
        }
    }

    private fun generateChartData(trendData: List<RevenueTrendItem>): List<ChartBarData> {
        val days = arrayOf("Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab")
        val result = mutableListOf<ChartBarData>()
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

        for (i in 6 downTo 0) {
            val d = Calendar.getInstance()
            d.add(Calendar.DAY_OF_YEAR, -i)
            val dateStr = sdf.format(d.time)
            val dayName = days[d.get(Calendar.DAY_OF_WEEK) - 1]

            val dailyAmt = trendData.filter { it.date == dateStr }.sumOf { it.amount }
            result.add(ChartBarData(dayName = dayName, dateStr = dateStr, amount = dailyAmt))
        }
        return result
    }
}
