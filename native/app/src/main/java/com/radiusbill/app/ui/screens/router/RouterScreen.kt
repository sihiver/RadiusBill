package com.radiusbill.app.ui.screens.router

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
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
import com.radiusbill.app.data.model.RouterClient
import com.radiusbill.app.ui.components.*
import com.radiusbill.app.ui.theme.*
import com.radiusbill.app.util.Formatters

@Composable
fun RouterScreen(
    searchQuery: String,
    viewModel: RouterViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    var showAddEditDialog by remember { mutableStateOf(false) }
    var selectedRouterForEdit by remember { mutableStateOf<RouterClient?>(null) }
    var routerToDelete by remember { mutableStateOf<RouterClient?>(null) }
    var routerToExtend by remember { mutableStateOf<RouterClient?>(null) }
    var routerToIsolir by remember { mutableStateOf<RouterClient?>(null) }

    LaunchedEffect(uiState.message) {
        uiState.message?.let {
            Toast.makeText(context, it, Toast.LENGTH_SHORT).show()
            viewModel.clearMessage()
        }
    }

    if (showAddEditDialog) {
        RouterDialog(
            initialRouter = selectedRouterForEdit,
            packages = uiState.packages,
            onDismiss = {
                showAddEditDialog = false
                selectedRouterForEdit = null
            },
            onSave = { req ->
                val current = selectedRouterForEdit
                if (current != null) {
                    viewModel.updateRouter(current.id, req)
                } else {
                    viewModel.createRouter(req)
                }
                showAddEditDialog = false
                selectedRouterForEdit = null
            }
        )
    }

    routerToDelete?.let { router ->
        ConfirmationDialog(
            title = "Hapus Router",
            message = "Yakin ingin menghapus router pelanggan \"${router.customerName}\"?",
            confirmText = "Hapus",
            isDestructive = true,
            onConfirm = {
                viewModel.deleteRouter(router.id)
                routerToDelete = null
            },
            onDismiss = { routerToDelete = null }
        )
    }

    routerToExtend?.let { router ->
        ConfirmationDialog(
            title = "Perpanjang Router",
            message = "Perpanjang masa aktif router \"${router.customerName}\" selama 30 hari?",
            confirmText = "Perpanjang",
            onConfirm = {
                viewModel.extendRouter(router.id, days = 30)
                routerToExtend = null
            },
            onDismiss = { routerToExtend = null }
        )
    }

    routerToIsolir?.let { router ->
        val actionText = if (router.isolir) "Buka Isolir" else "Isolir"
        val actionMsg = if (router.isolir) {
            "Buka isolir untuk router \"${router.customerName}\"?"
        } else {
            "Isolir router pelanggan \"${router.customerName}\"?"
        }
        ConfirmationDialog(
            title = actionText,
            message = actionMsg,
            confirmText = actionText,
            isDestructive = !router.isolir,
            onConfirm = {
                viewModel.toggleIsolir(router)
                routerToIsolir = null
            },
            onDismiss = { routerToIsolir = null }
        )
    }

    val filteredRouters = remember(uiState.routers, searchQuery) {
        uiState.routers.filter { r ->
            searchQuery.isBlank() ||
                    r.customerName.contains(searchQuery, ignoreCase = true) ||
                    r.pppoeUser.contains(searchQuery, ignoreCase = true) ||
                    (r.activeIp?.contains(searchQuery, ignoreCase = true) == true) ||
                    (r.routerIp?.contains(searchQuery, ignoreCase = true) == true) ||
                    (r.packageName?.contains(searchQuery, ignoreCase = true) == true)
        }
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    selectedRouterForEdit = null
                    showAddEditDialog = true
                },
                containerColor = PrimaryIndigo,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "Tambah Router")
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
                LoadingState(message = "Memuat daftar router PPPoE...")
            } else if (filteredRouters.isEmpty()) {
                EmptyState(message = "Tidak ada router PPPoE yang ditemukan.")
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredRouters, key = { it.id }) { router ->
                        RouterItemCard(
                            router = router,
                            onEdit = {
                                selectedRouterForEdit = router
                                showAddEditDialog = true
                            },
                            onToggleIsolir = { routerToIsolir = router },
                            onExtend = { routerToExtend = router },
                            onDelete = { routerToDelete = router }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun RouterItemCard(
    router: RouterClient,
    onEdit: () -> Unit,
    onToggleIsolir: () -> Unit,
    onExtend: () -> Unit,
    onDelete: () -> Unit
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
            // Header
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
                            .background(WarningAmberLight),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = router.customerName.take(1).uppercase(),
                            color = WarningAmber,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = router.customerName,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = router.activeIp ?: router.routerIp ?: "IP Belum Terdeteksi",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                StatusBadge(status = router.displayStatus)
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
                    Text("Paket Langganan:", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(router.packageName ?: "-", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Username PPPoE:", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(router.pppoeUser, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Password PPPoE:", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(router.pppoePass, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
                }

                if (!router.expiryDate.isNullOrBlank()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Tgl Kedaluwarsa:", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(Formatters.formatDate(router.expiryDate), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                OutlinedButton(
                    onClick = onEdit,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Edit", fontSize = 12.sp)
                }

                Button(
                    onClick = onToggleIsolir,
                    modifier = Modifier.weight(1.3f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (router.isolir) SuccessGreen else WarningAmber
                    )
                ) {
                    Text(if (router.isolir) "Buka Isolir" else "Isolir", fontSize = 12.sp)
                }

                Button(
                    onClick = onExtend,
                    modifier = Modifier.weight(1.3f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryIndigo)
                ) {
                    Text("Perpanjang", fontSize = 12.sp)
                }

                OutlinedButton(
                    onClick = onDelete,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = DangerRed)
                ) {
                    Text("Hapus", fontSize = 12.sp)
                }
            }
        }
    }
}
