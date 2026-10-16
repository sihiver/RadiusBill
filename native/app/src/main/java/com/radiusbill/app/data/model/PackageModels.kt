package com.radiusbill.app.data.model

import com.google.gson.annotations.SerializedName

data class PackageItem(
    @SerializedName("id") val id: Long,
    @SerializedName("name") val name: String,
    @SerializedName("type") val type: String? = null,
    @SerializedName("price") val price: Double = 0.0,
    @SerializedName("duration") val duration: String? = null,
    @SerializedName("validity") val validity: String? = null,
    @SerializedName("quota") val quota: String? = null,
    @SerializedName("rate_limit") val rateLimit: String? = null
)
