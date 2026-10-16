package com.radiusbill.app.util

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object Formatters {

    fun formatRupiah(amount: Double): String {
        val format = NumberFormat.getCurrencyInstance(Locale("id", "ID"))
        format.maximumFractionDigits = 0
        return format.format(amount)
    }

    fun formatCompactNumber(amount: Double): String {
        return when {
            amount >= 1_000_000_000 -> String.format(Locale.getDefault(), "%.1f M", amount / 1_000_000_000)
            amount >= 1_000_000 -> String.format(Locale.getDefault(), "%.1f jt", amount / 1_000_000)
            amount >= 1_000 -> String.format(Locale.getDefault(), "%.0f rb", amount / 1_000)
            else -> amount.toLong().toString()
        }
    }

    fun getCurrentDateTimeString(): String {
        val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale("id", "ID"))
        return sdf.format(Date())
    }

    fun generateInvoiceId(): String {
        val sdf = SimpleDateFormat("yyyyMMdd", Locale.getDefault())
        val datePart = sdf.format(Date())
        val randomPart = (1000..9999).random()
        return "INV-$datePart-$randomPart"
    }

    fun formatDate(isoDate: String?): String {
        if (isoDate.isNullOrBlank()) return "-"
        return try {
            val inputFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val outputFormat = SimpleDateFormat("dd MMM yyyy", Locale("id", "ID"))
            val date = inputFormat.parse(isoDate.take(10))
            if (date != null) outputFormat.format(date) else isoDate
        } catch (e: Exception) {
            isoDate
        }
    }
}
