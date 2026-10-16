package com.radiusbill.app.ui.screens.member

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radiusbill.app.data.model.Member
import com.radiusbill.app.data.model.PackageItem
import com.radiusbill.app.ui.components.*
import com.radiusbill.app.ui.theme.*
import com.radiusbill.app.util.Formatters
import com.radiusbill.app.util.PrintUtils
import kotlinx.coroutines.launch

@Composable
fun MemberScreen(
    searchQuery: String,
    viewModel: MemberViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var showAddEditDialog by remember { mutableStateOf(false) }
    var selectedMemberForEdit by remember { mutableStateOf<Member?>(null) }
    var memberToDelete by remember { mutableStateOf<Member?>(null) }
    var memberToExtend by remember { mutableStateOf<Member?>(null) }

    LaunchedEffect(uiState.message) {
        uiState.message?.let {
            Toast.makeText(context, it, Toast.LENGTH_SHORT).show()
            viewModel.clearMessage()
        }
    }

    if (showAddEditDialog) {
        MemberDialog(
            initialMember = selectedMemberForEdit,
            packages = uiState.packages,
            onDismiss = {
                showAddEditDialog = false
                selectedMemberForEdit = null
            },
            onSave = { req ->
                val current = selectedMemberForEdit
                if (current != null) {
                    viewModel.updateMember(current.id, req)
                } else {
                    viewModel.createMember(req)
                }
                showAddEditDialog = false
                selectedMemberForEdit = null
            }
        )
    }

    memberToDelete?.let { member ->
        ConfirmationDialog(
            title = "Hapus Member",
            message = "Yakin ingin menghapus member \"${member.name}\"?",
            confirmText = "Hapus",
            isDestructive = true,
            onConfirm = {
                viewModel.deleteMember(member.id)
                memberToDelete = null
            },
            onDismiss = { memberToDelete = null }
        )
    }

    memberToExtend?.let { member ->
        ConfirmationDialog(
            title = "Extend Member",
            message = "Perpanjang masa aktif member \"${member.name}\" selama 30 hari?",
            confirmText = "Extend",
            onConfirm = {
                viewModel.extendMember(member.id, days = 30)
                memberToExtend = null
            },
            onDismiss = { memberToExtend = null }
        )
    }

    val filteredMembers = remember(uiState.members, searchQuery) {
        uiState.members.filter { m ->
            searchQuery.isBlank() ||
                    m.name.contains(searchQuery, ignoreCase = true) ||
                    m.username.contains(searchQuery, ignoreCase = true) ||
                    (m.phone?.contains(searchQuery, ignoreCase = true) == true) ||
                    (m.packageName?.contains(searchQuery, ignoreCase = true) == true)
        }
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    selectedMemberForEdit = null
                    showAddEditDialog = true
                },
                containerColor = PrimaryIndigo,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "Tambah Member")
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (uiState.isLoading && !uiState.isRefreshing) {
                LoadingState(message = "Memuat daftar member...")
            } else if (filteredMembers.isEmpty()) {
                EmptyState(message = "Tidak ada data member yang ditemukan.")
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredMembers, key = { it.id }) { member ->
                        val pkg = uiState.packages.find { it.id == member.packageId || it.name == member.packageName }
                        MemberItemCard(
                            member = member,
                            pkg = pkg,
                            onEdit = {
                                selectedMemberForEdit = member
                                showAddEditDialog = true
                            },
                            onExtend = { memberToExtend = member },
                            onDelete = { memberToDelete = member },
                            onShare = {
                                val message = buildString {
                                    append("Halo ${member.name},\n")
                                    append("Berikut adalah detail login WiFi Anda:\n\n")
                                    append("Username: ${member.username}\n")
                                    append("Password: ${member.password ?: "******"}\n")
                                    append("Paket: ${member.packageName ?: "-"}\n\n")
                                    append("Terima kasih.")
                                }
                                PrintUtils.shareText(context, "Bagikan Akun Member", message)
                            },
                            onPrint = {
                                coroutineScope.launch {
                                    val result = viewModel.printerManager.printMember(member, pkg)
                                    if (result.isSuccess) {
                                        Toast.makeText(context, "Detail member berhasil dicetak ke printer Bluetooth", Toast.LENGTH_SHORT).show()
                                    } else {
                                        Toast.makeText(context, "Bluetooth tidak terhubung. Menggunakan pencetakan dokumen.", Toast.LENGTH_SHORT).show()
                                        val html = PrintUtils.generateMemberHtml(member.username, member.password, member.packageName)
                                        PrintUtils.printHtmlReceipt(context, "Member-${member.username}", html)
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun MemberItemCard(
    member: Member,
    pkg: PackageItem?,
    onEdit: () -> Unit,
    onExtend: () -> Unit,
    onDelete: () -> Unit,
    onShare: () -> Unit,
    onPrint: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Header Row: Avatar, Name & Phone, Print & Share shortcuts
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(PrimaryIndigoLight),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = member.name.take(1).uppercase(),
                            color = PrimaryIndigo,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = member.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = member.phone ?: "Tanpa nomor telepon",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Row {
                    IconButton(onClick = onShare) {
                        Icon(Icons.Default.Share, contentDescription = "Share", tint = InfoBlue, modifier = Modifier.size(20.dp))
                    }
                    IconButton(onClick = onPrint) {
                        Icon(Icons.Default.Print, contentDescription = "Print", tint = SuccessGreen, modifier = Modifier.size(20.dp))
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Body info
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.background)
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Username:", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(member.username, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Paket:", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(member.packageName ?: pkg?.name ?: "-", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("MAC Binding:", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        if (member.macBinding) "Aktif (${member.macAddress ?: "Auto-bind"})" else "Nonaktif",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (member.macBinding) SuccessGreen else DangerRed
                    )
                }

                if (!member.expiryDate.isNullOrBlank()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Tgl Kedaluwarsa:", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(Formatters.formatDate(member.expiryDate), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onEdit,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Edit")
                }

                Button(
                    onClick = onExtend,
                    modifier = Modifier.weight(1.3f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryIndigo)
                ) {
                    Text("Extend")
                }

                OutlinedButton(
                    onClick = onDelete,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = DangerRed)
                ) {
                    Text("Hapus")
                }
            }
        }
    }
}
