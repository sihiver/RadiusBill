package com.radiusbill.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.radiusbill.app.data.model.Member
import com.radiusbill.app.data.model.MemberRequest
import com.radiusbill.app.data.model.PackageItem
import com.radiusbill.app.data.model.RouterClient
import com.radiusbill.app.data.model.RouterClientRequest
import com.radiusbill.app.ui.theme.PrimaryIndigo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemberDialog(
    initialMember: Member? = null,
    packages: List<PackageItem>,
    onDismiss: () -> Unit,
    onSave: (MemberRequest) -> Unit
) {
    var name by remember { mutableStateOf(initialMember?.name ?: "") }
    var username by remember { mutableStateOf(initialMember?.username ?: "") }
    var password by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf(initialMember?.phone ?: "") }
    var selectedPackageId by remember { mutableStateOf(initialMember?.packageId) }
    var macBinding by remember { mutableStateOf(initialMember?.macBinding ?: true) }
    var macAddress by remember { mutableStateOf(initialMember?.macAddress ?: "") }
    var bypassHotspot by remember { mutableStateOf(initialMember?.bypassHotspot ?: false) }

    var expandedPackageDropdown by remember { mutableStateOf(false) }
    val selectedPackage = packages.find { it.id == selectedPackageId }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (initialMember == null) "Tambah Member Hotspot" else "Edit Member Hotspot",
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nama Lengkap") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("Username") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text(if (initialMember == null) "Password" else "Password Baru (Kosongkan jika tetap)") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("No. WhatsApp / Telepon") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Package dropdown
                ExposedDropdownMenuBox(
                    expanded = expandedPackageDropdown,
                    onExpandedChange = { expandedPackageDropdown = !expandedPackageDropdown }
                ) {
                    OutlinedTextField(
                        value = selectedPackage?.name ?: "Pilih Paket...",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Paket Langganan") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedPackageDropdown) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = expandedPackageDropdown,
                        onDismissRequest = { expandedPackageDropdown = false }
                    ) {
                        packages.forEach { pkg ->
                            DropdownMenuItem(
                                text = { Text(pkg.name) },
                                onClick = {
                                    selectedPackageId = pkg.id
                                    expandedPackageDropdown = false
                                }
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Kunci MAC (MAC Binding)", style = MaterialTheme.typography.bodyMedium)
                    Switch(checked = macBinding, onCheckedChange = { macBinding = it })
                }

                if (macBinding) {
                    OutlinedTextField(
                        value = macAddress,
                        onValueChange = { macAddress = it },
                        label = { Text("MAC Address (Opsional)") },
                        placeholder = { Text("Auto-bind saat login pertama") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Bypass Hotspot (IP Bind)", style = MaterialTheme.typography.bodyMedium)
                    Switch(checked = bypassHotspot, onCheckedChange = { bypassHotspot = it })
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank() && username.isNotBlank()) {
                        onSave(
                            MemberRequest(
                                name = name.trim(),
                                username = username.trim(),
                                password = password.ifBlank { null },
                                phone = phone.trim().ifBlank { null },
                                packageId = selectedPackageId,
                                macBinding = macBinding,
                                macAddress = if (macBinding && macAddress.isNotBlank()) macAddress.trim() else null,
                                bypassHotspot = bypassHotspot
                            )
                        )
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryIndigo)
            ) {
                Text("Simpan")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Batal")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RouterDialog(
    initialRouter: RouterClient? = null,
    packages: List<PackageItem>,
    onDismiss: () -> Unit,
    onSave: (RouterClientRequest) -> Unit
) {
    var customerName by remember { mutableStateOf(initialRouter?.customerName ?: "") }
    var pppoeUser by remember { mutableStateOf(initialRouter?.pppoeUser ?: "") }
    var pppoePass by remember { mutableStateOf(initialRouter?.pppoePass ?: "") }
    var routerIp by remember { mutableStateOf(initialRouter?.routerIp ?: "") }
    var selectedPackageId by remember { mutableStateOf(initialRouter?.packageId) }
    var expandedPackageDropdown by remember { mutableStateOf(false) }

    val selectedPackage = packages.find { it.id == selectedPackageId }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (initialRouter == null) "Tambah Router PPPoE" else "Edit Router PPPoE",
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = customerName,
                    onValueChange = { customerName = it },
                    label = { Text("Nama Pelanggan") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = pppoeUser,
                    onValueChange = { pppoeUser = it },
                    label = { Text("Username PPPoE") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = pppoePass,
                    onValueChange = { pppoePass = it },
                    label = { Text("Password PPPoE") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = routerIp,
                    onValueChange = { routerIp = it },
                    label = { Text("IP Router / Static (Opsional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                ExposedDropdownMenuBox(
                    expanded = expandedPackageDropdown,
                    onExpandedChange = { expandedPackageDropdown = !expandedPackageDropdown }
                ) {
                    OutlinedTextField(
                        value = selectedPackage?.name ?: "Pilih Paket...",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Paket PPPoE") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedPackageDropdown) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = expandedPackageDropdown,
                        onDismissRequest = { expandedPackageDropdown = false }
                    ) {
                        packages.forEach { pkg ->
                            DropdownMenuItem(
                                text = { Text(pkg.name) },
                                onClick = {
                                    selectedPackageId = pkg.id
                                    expandedPackageDropdown = false
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (customerName.isNotBlank() && pppoeUser.isNotBlank() && pppoePass.isNotBlank()) {
                        onSave(
                            RouterClientRequest(
                                customerName = customerName.trim(),
                                pppoeUser = pppoeUser.trim(),
                                pppoePass = pppoePass.trim(),
                                routerIp = routerIp.trim().ifBlank { null },
                                packageId = selectedPackageId,
                                packageName = selectedPackage?.name
                            )
                        )
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryIndigo)
            ) {
                Text("Simpan")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Batal")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GenerateVouchersDialog(
    packages: List<PackageItem>,
    onDismiss: () -> Unit,
    onGenerate: (packageId: Long, quantity: Int, prefix: String) -> Unit
) {
    var selectedPackageId by remember { mutableStateOf(packages.firstOrNull()?.id ?: 0L) }
    var quantityText by remember { mutableStateOf("10") }
    var prefixText by remember { mutableStateOf("") }
    var expanded by remember { mutableStateOf(false) }

    val selectedPackage = packages.find { it.id == selectedPackageId }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Generate Voucher Batch", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = !expanded }
                ) {
                    OutlinedTextField(
                        value = selectedPackage?.name ?: "Pilih Paket...",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Paket Voucher") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        packages.forEach { pkg ->
                            DropdownMenuItem(
                                text = { Text(pkg.name) },
                                onClick = {
                                    selectedPackageId = pkg.id
                                    expanded = false
                                }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = quantityText,
                    onValueChange = { quantityText = it.filter { ch -> ch.isDigit() } },
                    label = { Text("Jumlah Voucher") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = prefixText,
                    onValueChange = { prefixText = it },
                    label = { Text("Prefix Kode (Opsional)") },
                    placeholder = { Text("Contoh: VIP-") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val q = quantityText.toIntOrNull() ?: 10
                    if (selectedPackageId > 0 && q > 0) {
                        onGenerate(selectedPackageId, q, prefixText.trim())
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryIndigo)
            ) {
                Text("Generate")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Batal")
            }
        }
    )
}

@Composable
fun ConfirmationDialog(
    title: String,
    message: String,
    confirmText: String = "Ya, Lanjutkan",
    isDestructive: Boolean = false,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, fontWeight = FontWeight.Bold) },
        text = { Text(message) },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isDestructive) MaterialTheme.colorScheme.error else PrimaryIndigo
                )
            ) {
                Text(confirmText)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Batal")
            }
        }
    )
}
