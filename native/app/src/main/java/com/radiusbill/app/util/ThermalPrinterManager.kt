package com.radiusbill.app.util

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import com.radiusbill.app.data.local.PreferencesManager
import com.radiusbill.app.data.model.Member
import com.radiusbill.app.data.model.PackageItem
import com.radiusbill.app.data.model.Voucher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStream
import java.util.UUID

class ThermalPrinterManager(private val context: Context) {

    private val prefs = PreferencesManager(context)
    private var bluetoothSocket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null

    companion object {
        // Standard Serial Port Profile (SPP) UUID
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

        // ESC/POS Commands
        private val ESC_INIT = byteArrayOf(0x1B, 0x40)
        private val ESC_ALIGN_LEFT = byteArrayOf(0x1B, 0x61, 0x00)
        private val ESC_ALIGN_CENTER = byteArrayOf(0x1B, 0x61, 0x01)
        private val ESC_ALIGN_RIGHT = byteArrayOf(0x1B, 0x61, 0x02)
        private val ESC_BOLD_ON = byteArrayOf(0x1B, 0x45, 0x01)
        private val ESC_BOLD_OFF = byteArrayOf(0x1B, 0x45, 0x00)
        private val ESC_FEED_PAPER = byteArrayOf(0x1D, 0x56, 0x41, 0x00)
    }

    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothManager?.adapter
    }

    val isBluetoothEnabled: Boolean
        get() = bluetoothAdapter?.isEnabled == true

    @SuppressLint("MissingPermission")
    fun getPairedDevices(): List<BluetoothDeviceInfo> {
        val adapter = bluetoothAdapter ?: return emptyList()
        return try {
            adapter.bondedDevices.map { device ->
                BluetoothDeviceInfo(
                    name = device.name ?: "Unknown Device",
                    macAddress = device.address
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    @SuppressLint("MissingPermission")
    suspend fun connect(macAddress: String): Result<Boolean> = withContext(Dispatchers.IO) {
        val adapter = bluetoothAdapter ?: return@withContext Result.failure(Exception("Bluetooth tidak tersedia pada perangkat ini"))
        disconnect()

        try {
            val device: BluetoothDevice = adapter.getRemoteDevice(macAddress)
            val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            adapter.cancelDiscovery()
            socket.connect()

            bluetoothSocket = socket
            outputStream = socket.outputStream

            prefs.savedPrinterMac = macAddress
            prefs.savedPrinterName = device.name ?: "Printer Bluetooth"

            Result.success(true)
        } catch (e: Exception) {
            disconnect()
            Result.failure(e)
        }
    }

    suspend fun disconnect() = withContext(Dispatchers.IO) {
        try {
            outputStream?.flush()
            outputStream?.close()
            outputStream = null
        } catch (ignored: Exception) {}

        try {
            bluetoothSocket?.close()
            bluetoothSocket = null
        } catch (ignored: Exception) {}
    }

    val isConnected: Boolean
        get() = bluetoothSocket?.isConnected == true

    suspend fun printTest(): Result<Boolean> = withContext(Dispatchers.IO) {
        val testText = buildString {
            append("================================\n")
            append("       TEST PRINT SUCCESS       \n")
            append("   Printer Thermal Siap Pakai   \n")
            append("================================\n\n\n\n")
        }
        sendRawText(testText)
    }

    suspend fun printVoucher(
        voucher: Voucher,
        pkg: PackageItem? = null
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        val todayStr = Formatters.getCurrentDateTimeString()
        val invId = Formatters.generateInvoiceId()
        val price = pkg?.price ?: voucher.price ?: 0.0
        val priceStr = Formatters.formatRupiah(price)

        val receiptText = buildString {
            append("================================\n")
            append("     MQL.net BILLING SYSTEM     \n")
            append("          HOTSPOT & ISP         \n")
            append("       Telp: 085311753779       \n")
            append("================================\n\n")
            append("Tanggal : $todayStr\n")
            append("ID Trans: $invId\n")
            append("Kasir   : Admin\n\n")
            append("-------- DETAIL AKUN --------\n")
            append("Voucher    : ${voucher.code}\n")
            append("Paket      : ${voucher.packageName ?: pkg?.name ?: "Voucher Hotspot"}\n")
            append("Harga      : $priceStr\n")
            append("Durasi     : ${voucher.duration ?: pkg?.duration ?: "Sesuai Paket"}\n")
            append("Masa Aktif : ${voucher.validity ?: pkg?.validity ?: "Sesuai Paket"}\n")
            append("Kuota      : ${voucher.quota ?: pkg?.quota ?: "Tidak Terbatas"}\n")
            append("-------- TERIMA KASIH --------\n")
            append("  Layanan Cepat & Terjangkau    \n")
            append("Simpan struk ini sebagai bukti  \n")
            append("================================\n\n\n\n")
        }

        sendRawText(receiptText)
    }

    suspend fun printMember(
        member: Member,
        pkg: PackageItem? = null
    ): Result<Boolean> = withContext(Dispatchers.IO) {
        val todayStr = Formatters.getCurrentDateTimeString()
        val invId = Formatters.generateInvoiceId()
        val price = pkg?.price ?: member.price ?: 0.0
        val priceStr = Formatters.formatRupiah(price)

        val receiptText = buildString {
            append("================================\n")
            append("     MQL.net BILLING SYSTEM     \n")
            append("          HOTSPOT & ISP         \n")
            append("       Telp: 085311753779       \n")
            append("================================\n\n")
            append("Tanggal : $todayStr\n")
            append("ID Trans: $invId\n")
            append("Kasir   : Admin\n\n")
            append("-------- DETAIL AKUN --------\n")
            append("Username   : ${member.username}\n")
            append("Password   : ${member.password ?: "******"}\n")
            append("Paket      : ${member.packageName ?: pkg?.name ?: "Member Hotspot"}\n")
            append("Harga      : $priceStr\n")
            append("Masa Aktif : ${member.validity ?: pkg?.validity ?: "30 Hari"}\n")
            append("MAC Bind   : ${if (member.macBinding) "Aktif" else "Nonaktif"}\n")
            append("-------- TERIMA KASIH --------\n")
            append("  Layanan Cepat & Terjangkau    \n")
            append("Simpan struk ini sebagai bukti  \n")
            append("================================\n\n\n\n")
        }

        sendRawText(receiptText)
    }

    private suspend fun sendRawText(text: String): Result<Boolean> = withContext(Dispatchers.IO) {
        val out = outputStream ?: run {
            // Attempt auto-reconnect if saved printer exists
            val savedMac = prefs.savedPrinterMac
            if (!savedMac.isNullOrBlank()) {
                val connectResult = connect(savedMac)
                if (connectResult.isFailure) {
                    return@withContext Result.failure(Exception("Printer tidak terhubung. Silakan sambungkan di Pengaturan."))
                }
                outputStream
            } else {
                return@withContext Result.failure(Exception("Belum ada printer yang terhubung."))
            }
        }

        try {
            out?.write(ESC_INIT)
            out?.write(text.toByteArray(Charsets.US_ASCII))
            out?.flush()
            Result.success(true)
        } catch (e: Exception) {
            disconnect()
            Result.failure(e)
        }
    }
}

data class BluetoothDeviceInfo(
    val name: String,
    val macAddress: String
)
