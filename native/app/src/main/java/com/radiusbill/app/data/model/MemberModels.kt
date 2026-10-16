package com.radiusbill.app.data.model

import com.google.gson.annotations.SerializedName

data class Member(
    @SerializedName("id") val id: Long,
    @SerializedName("name") val name: String,
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("package_id") val packageId: Long? = null,
    @SerializedName("package_name") val packageName: String? = null,
    @SerializedName("mac_binding") val macBinding: Boolean = true,
    @SerializedName("mac_address") val macAddress: String? = null,
    @SerializedName("bypass_hotspot") val bypassHotspot: Boolean = false,
    @SerializedName("expiry_date") val expiryDate: String? = null,
    @SerializedName("price") val price: Double? = null,
    @SerializedName("duration") val duration: String? = null,
    @SerializedName("validity") val validity: String? = null,
    @SerializedName("quota") val quota: String? = null
)

data class MemberRequest(
    @SerializedName("name") val name: String,
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("package_id") val packageId: Long? = null,
    @SerializedName("mac_binding") val macBinding: Boolean = true,
    @SerializedName("mac_address") val macAddress: String? = null,
    @SerializedName("bypass_hotspot") val bypassHotspot: Boolean = false
)

data class ExtendMemberRequest(
    @SerializedName("days") val days: Int = 30
)
