package com.radiusbill.app.data.model

import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class Voucher(
    @SerializedName("id") val id: Long,
    @SerializedName("code") val code: String,
    @SerializedName("package_id") val packageId: Long? = null,
    @SerializedName("package_name") val packageName: String? = null,
    @SerializedName("status") val rawStatus: String? = "Unused",
    @SerializedName("used_bytes") val usedBytes: Long? = null,
    @SerializedName("quota_seconds") val quotaSeconds: Long? = null,
    @SerializedName("current_session_time") val currentSessionTime: Long? = null,
    @SerializedName("used_seconds") val usedSeconds: Long? = null,
    @SerializedName("expires_at") val expiresAt: String? = null,
    @SerializedName("duration") val duration: String? = null,
    @SerializedName("validity") val validity: String? = null,
    @SerializedName("quota") val quota: String? = null,
    @SerializedName("price") val price: Double? = null,
    @SerializedName("created_at") val createdAt: String? = null
) {
    val computedStatus: String
        get() {
            val status = rawStatus ?: "Unused"
            if (status.equals("Active", ignoreCase = true)) {
                val quotaSec = quotaSeconds ?: 0L
                if (quotaSec > 0) {
                    val curr = currentSessionTime ?: 0L
                    val total = (usedSeconds ?: 0L) + curr
                    val rem = quotaSec - total
                    if (rem <= 0) return "Expired"
                } else if (!expiresAt.isNullOrBlank()) {
                    try {
                        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                        val exp = format.parse(expiresAt)
                        if (exp != null && exp.time <= System.currentTimeMillis()) {
                            return "Expired"
                        }
                    } catch (e: Exception) {
                        // ignore parse errors
                    }
                }
            }
            return status
        }

    val formattedUsedBytes: String
        get() {
            val bytes = usedBytes ?: 0L
            if (bytes <= 0) return "0 MB"
            val kb = bytes / 1024.0
            val mb = kb / 1024.0
            val gb = mb / 1024.0
            return when {
                gb >= 1.0 -> String.format(Locale.getDefault(), "%.1f GB", gb)
                mb >= 1.0 -> String.format(Locale.getDefault(), "%.1f MB", mb)
                kb >= 1.0 -> String.format(Locale.getDefault(), "%.1f KB", kb)
                else -> "$bytes B"
            }
        }

    val computedTimeLeft: String
        get() {
            if (computedStatus.equals("Unused", ignoreCase = true)) {
                return duration ?: validity ?: "-"
            }
            if (computedStatus.equals("Active", ignoreCase = true)) {
                val quotaSec = quotaSeconds ?: 0L
                if (quotaSec > 0) {
                    val curr = currentSessionTime ?: 0L
                    val total = (usedSeconds ?: 0L) + curr
                    val rem = (quotaSec - total).coerceAtLeast(0L)
                    if (rem <= 0) return "Expired"

                    val h = rem / 3600
                    val m = (rem % 3600) / 60
                    val s = rem % 60
                    if (h >= 24) {
                        val d = h / 24
                        val rh = h % 24
                        return "$d Hari $rh Jam"
                    }
                    return String.format(Locale.getDefault(), "%02d:%02d:%02d", h, m, s)
                }
                if (!expiresAt.isNullOrBlank()) {
                    try {
                        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                        val exp = format.parse(expiresAt)
                        if (exp != null) {
                            val remMs = exp.time - System.currentTimeMillis()
                            if (remMs <= 0) return "Expired"
                            val remSec = remMs / 1000
                            val h = remSec / 3600
                            val m = (remSec % 3600) / 60
                            val s = remSec % 60
                            if (h >= 24) {
                                val d = h / 24
                                val rh = h % 24
                                return "$d Hari $rh Jam"
                            }
                            return String.format(Locale.getDefault(), "%02d:%02d:%02d", h, m, s)
                        }
                    } catch (e: Exception) {
                        return "-"
                    }
                }
                return "-"
            }
            return "Expired"
        }
}

data class GenerateVoucherRequest(
    @SerializedName("package_id") val packageId: Long,
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("prefix") val prefix: String? = null,
    @SerializedName("character_length") val characterLength: Int = 6
)
