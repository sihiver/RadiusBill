package com.radiusbill.app.data.model

import com.google.gson.annotations.SerializedName

data class ReportSummaryData(
    @SerializedName("revenue_this_month") private val rawRevenueThisMonth: Any? = null,
    @SerializedName("revenue_today") private val rawRevenueToday: Any? = null,
    @SerializedName("active_vouchers") private val rawActiveVouchers: Any? = null,
    @SerializedName("active_members") private val rawActiveMembers: Any? = null,
    @SerializedName("active_routers") private val rawActiveRouters: Any? = null
) {
    val revenueThisMonth: Double
        get() = parseToDouble(rawRevenueThisMonth)

    val revenueToday: Double
        get() = parseToDouble(rawRevenueToday)

    val activeVouchers: Int
        get() = parseToInt(rawActiveVouchers)

    val activeMembers: Int
        get() = parseToInt(rawActiveMembers)

    val activeRouters: Int
        get() = parseToInt(rawActiveRouters)

    companion object {
        fun parseToDouble(value: Any?): Double {
            return when (value) {
                is Number -> value.toDouble()
                is String -> value.toDoubleOrNull() ?: 0.0
                else -> 0.0
            }
        }

        fun parseToInt(value: Any?): Int {
            return when (value) {
                is Number -> value.toInt()
                is String -> value.toIntOrNull() ?: value.toDoubleOrNull()?.toInt() ?: 0
                else -> 0
            }
        }
    }
}

data class RevenueItem(
    @SerializedName("id") val id: Long? = null,
    @SerializedName("date") val date: String? = null,
    @SerializedName("total_amount") private val rawTotalAmount: Any? = null,
    @SerializedName("amount") private val rawAmount: Any? = null,
    @SerializedName("transaction_count") private val rawTransactionCount: Any? = null,
    @SerializedName("type") val type: String? = "Voucher",
    @SerializedName("description") val description: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
) {
    val totalAmount: Double
        get() = displayAmount

    val amount: Double
        get() = displayAmount

    val displayAmount: Double
        get() = ReportSummaryData.parseToDouble(rawTotalAmount ?: rawAmount)

    val transactionCount: Int
        get() = displayCount

    val displayCount: Int
        get() = ReportSummaryData.parseToInt(rawTransactionCount).coerceAtLeast(1)
}
