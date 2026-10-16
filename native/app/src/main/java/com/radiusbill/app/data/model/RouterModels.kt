package com.radiusbill.app.data.model

import com.google.gson.annotations.SerializedName

data class RouterClient(
    @SerializedName("id") val id: Long,
    @SerializedName("customer_name") val customerName: String,
    @SerializedName("pppoe_user") val pppoeUser: String,
    @SerializedName("pppoe_pass") val pppoePass: String,
    @SerializedName("router_ip") val routerIp: String? = null,
    @SerializedName("active_ip") val activeIp: String? = null,
    @SerializedName("package_id") val packageId: Long? = null,
    @SerializedName("package_name") val packageName: String? = null,
    @SerializedName("status") val status: String? = "Offline",
    @SerializedName("isolir") val isolir: Boolean = false,
    @SerializedName("expiry_date") val expiryDate: String? = null
) {
    val displayStatus: String
        get() = if (isolir || status.equals("Isolated", ignoreCase = true)) "Isolated" else status ?: "Offline"
}

data class RouterClientRequest(
    @SerializedName("customer_name") val customerName: String,
    @SerializedName("pppoe_user") val pppoeUser: String,
    @SerializedName("pppoe_pass") val pppoePass: String,
    @SerializedName("router_ip") val routerIp: String? = null,
    @SerializedName("package_id") val packageId: Long? = null,
    @SerializedName("package_name") val packageName: String? = null
)

data class ExtendRouterRequest(
    @SerializedName("days") val days: Int = 30
)

data class IsolirRequest(
    @SerializedName("reason") val reason: String = "Tunggakan pembayaran"
)
