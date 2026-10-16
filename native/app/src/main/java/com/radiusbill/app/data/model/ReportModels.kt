package com.radiusbill.app.data.model

import com.google.gson.annotations.SerializedName

data class ReportSummaryData(
    @SerializedName("revenue_this_month") val revenueThisMonth: Double = 0.0,
    @SerializedName("revenue_today") val revenueToday: Double = 0.0,
    @SerializedName("active_vouchers") val activeVouchers: Int = 0,
    @SerializedName("active_members") val activeMembers: Int = 0,
    @SerializedName("active_routers") val activeRouters: Int = 0
)

data class RevenueItem(
    @SerializedName("id") val id: Long? = null,
    @SerializedName("date") val date: String? = null,
    @SerializedName("amount") val amount: Double = 0.0,
    @SerializedName("type") val type: String? = "Voucher",
    @SerializedName("description") val description: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)
