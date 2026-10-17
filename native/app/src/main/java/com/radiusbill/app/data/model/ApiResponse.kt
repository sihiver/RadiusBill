package com.radiusbill.app.data.model

import com.google.gson.annotations.SerializedName

data class ApiResponse<T>(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("data") val data: T? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("pagination") val pagination: PaginationInfo? = null
)

data class PaginationInfo(
    @SerializedName("page") val page: Int = 1,
    @SerializedName("limit") val limit: Int = 30,
    @SerializedName("total") val total: Int = 0,
    @SerializedName("pages") val pages: Int = 1
)
