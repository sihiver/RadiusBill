package com.radiusbill.app.data.model

import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class DashboardStatsData(
    @SerializedName("revenue") val revenue: RevenueInfo? = null,
    @SerializedName("sessions") val sessions: SessionInfo? = null,
    @SerializedName("revenueTrend") val revenueTrend: List<RevenueTrendItem>? = null
)

data class RevenueInfo(
    @SerializedName("this_month") val thisMonth: Double = 0.0,
    @SerializedName("last_month") val lastMonth: Double = 0.0,
    @SerializedName("today") val today: Double = 0.0
)

data class SessionInfo(
    @SerializedName("active_sessions") val activeSessions: String? = "0"
)

data class RevenueTrendItem(
    @SerializedName("date") val date: String,
    @SerializedName("amount") val amount: Double = 0.0
)

data class RadiusLogRaw(
    @SerializedName("id") val id: Long? = null,
    @SerializedName("username") val username: String? = null,
    @SerializedName("log_type") val logType: String? = "AUTH",
    @SerializedName("action") val action: String? = null,
    @SerializedName("reply") val reply: String? = null,
    @SerializedName("ip_address") val ipAddress: String? = null,
    @SerializedName("service") val service: String? = "RADIUS",
    @SerializedName("session_id") val sessionId: String? = null,
    @SerializedName("reason") val reason: String? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
) {
    val formattedTime: String
        get() {
            if (createdAt.isNullOrBlank()) return "--:--"
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                val outputFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                val date = inputFormat.parse(createdAt)
                if (date != null) outputFormat.format(date) else "--:--"
            } catch (e: Exception) {
                createdAt.takeLast(8)
            }
        }
}
