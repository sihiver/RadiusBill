package com.radiusbill.app.data.model

import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class DashboardStatsData(
    @SerializedName("vouchers") val vouchers: VoucherStatsInfo? = null,
    @SerializedName("members") val members: MemberStatsInfo? = null,
    @SerializedName("routers") val routers: RouterStatsInfo? = null,
    @SerializedName("revenue") val revenue: RevenueInfo? = null,
    @SerializedName("sessions") val sessions: SessionInfo? = null,
    @SerializedName("revenueTrend") val revenueTrend: List<RevenueTrendItem>? = null
)

data class VoucherStatsInfo(
    @SerializedName("active_vouchers") val activeVouchers: String? = "0",
    @SerializedName("unused_vouchers") val unusedVouchers: String? = "0",
    @SerializedName("expired_vouchers") val expiredVouchers: String? = "0"
)

data class MemberStatsInfo(
    @SerializedName("total_members") val totalMembers: String? = "0",
    @SerializedName("online_members") val onlineMembers: String? = "0",
    @SerializedName("expired_members") val expiredMembers: String? = "0"
)

data class RouterStatsInfo(
    @SerializedName("total_routers") val totalRouters: String? = "0",
    @SerializedName("online_routers") val onlineRouters: String? = "0",
    @SerializedName("isolated_routers") val isolatedRouters: String? = "0"
)

data class RevenueInfo(
    @SerializedName("this_month") private val rawThisMonth: Any? = null,
    @SerializedName("last_month") private val rawLastMonth: Any? = null,
    @SerializedName("today") private val rawToday: Any? = null
) {
    val thisMonth: Double
        get() = when (val v = rawThisMonth) {
            is Number -> v.toDouble()
            is String -> v.toDoubleOrNull() ?: 0.0
            else -> 0.0
        }

    val lastMonth: Double
        get() = when (val v = rawLastMonth) {
            is Number -> v.toDouble()
            is String -> v.toDoubleOrNull() ?: 0.0
            else -> 0.0
        }

    val today: Double
        get() = when (val v = rawToday) {
            is Number -> v.toDouble()
            is String -> v.toDoubleOrNull() ?: 0.0
            else -> 0.0
        }
}

data class SessionInfo(
    @SerializedName("active_sessions") val activeSessions: String? = "0"
)

data class RevenueTrendItem(
    @SerializedName("date") val date: String,
    @SerializedName("type") val type: String? = null,
    @SerializedName("amount") private val rawAmount: Any? = null
) {
    val amount: Double
        get() = when (val a = rawAmount) {
            is Number -> a.toDouble()
            is String -> a.toDoubleOrNull() ?: 0.0
            else -> 0.0
        }
}

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
