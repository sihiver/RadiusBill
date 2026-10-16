package com.radiusbill.app.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radiusbill.app.data.model.RadiusLogRaw
import com.radiusbill.app.ui.components.EmptyState
import com.radiusbill.app.ui.components.LoadingState
import com.radiusbill.app.ui.components.StatCard
import com.radiusbill.app.ui.theme.*
import com.radiusbill.app.util.Formatters

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    if (uiState.isLoading && !uiState.isRefreshing) {
        LoadingState(message = "Memuat dashboard...")
        return
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Main Revenue Highlight Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = PrimaryIndigo),
                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Omset Bulan Ini",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.White.copy(alpha = 0.85f)
                        )
                        Icon(
                            imageVector = Icons.Default.MonetizationOn,
                            contentDescription = null,
                            tint = Color.White.copy(alpha = 0.85f),
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = Formatters.formatRupiah(uiState.revenueThisMonth),
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(SuccessGreenLight)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "${uiState.onlineUsers} Sesi Aktif Online",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.9f)
                        )
                    }
                }
            }
        }

        // 2x2 Stats Grid
        item {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        title = "Voucher",
                        value = uiState.voucherCount.toString(),
                        icon = Icons.Default.ConfirmationNumber,
                        iconTint = PrimaryIndigo,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = "Member",
                        value = uiState.memberCount.toString(),
                        icon = Icons.Default.Group,
                        iconTint = SuccessGreen,
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        title = "Router PPPoE",
                        value = uiState.routerCount.toString(),
                        icon = Icons.Default.Router,
                        iconTint = WarningAmber,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = "Online",
                        value = uiState.onlineUsers.toString(),
                        icon = Icons.Default.Wifi,
                        iconTint = InfoBlue,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // 7-Day Revenue Trend Chart Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Tren Pendapatan 7 Hari",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Icon(
                            imageVector = Icons.Default.BarChart,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    val maxAmt = (uiState.chartData.maxOfOrNull { it.amount } ?: 100_000.0).coerceAtLeast(100_000.0)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Bottom
                    ) {
                        uiState.chartData.forEach { bar ->
                            val heightFraction = (bar.amount / maxAmt).toFloat().coerceIn(0.06f, 1f)

                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.weight(1f)
                            ) {
                                // 1. Value Text at Top
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(18.dp),
                                    contentAlignment = Alignment.BottomCenter
                                ) {
                                    if (bar.amount > 0) {
                                        Text(
                                            text = Formatters.formatCompactNumber(bar.amount),
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = PrimaryIndigo,
                                            maxLines = 1
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(4.dp))

                                // 2. Bar Container (Fixed 90.dp height, bar grows inside it)
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(90.dp),
                                    contentAlignment = Alignment.BottomCenter
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth(0.55f)
                                            .fillMaxHeight(heightFraction)
                                            .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                            .background(if (bar.amount > 0) PrimaryIndigo else MaterialTheme.colorScheme.surfaceVariant)
                                    )
                                }

                                Spacer(modifier = Modifier.height(6.dp))

                                // 3. Day Label at Bottom (Always fully visible)
                                Text(
                                    text = bar.dayName,
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontWeight = FontWeight.Medium,
                                    maxLines = 1
                                )
                            }
                        }
                    }
                }
            }
        }

        // Live Activity Logs Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Aktivitas RADIUS Terbaru",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                IconButton(onClick = { viewModel.refresh() }) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Refresh",
                        tint = PrimaryIndigo
                    )
                }
            }
        }

        if (uiState.logs.isEmpty()) {
            item {
                EmptyState(message = "Belum ada log autentikasi RADIUS.")
            }
        } else {
            items(uiState.logs) { log ->
                RadiusLogItemCard(log)
            }
        }
    }
}

@Composable
fun RadiusLogItemCard(log: RadiusLogRaw) {
    val isAccept = log.reply?.contains("Accept", ignoreCase = true) == true ||
            log.action?.contains("Accept", ignoreCase = true) == true
    val isReject = log.reply?.contains("Reject", ignoreCase = true) == true ||
            log.action?.contains("Reject", ignoreCase = true) == true

    val badgeColor = when {
        isAccept -> SuccessGreen
        isReject -> DangerRed
        else -> InfoBlue
    }

    val badgeBg = when {
        isAccept -> SuccessGreenLight
        isReject -> DangerRedLight
        else -> InfoBlueLight
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = log.username ?: "Unknown",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = log.formattedTime,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "IP: ${log.ipAddress ?: "-"} • Service: ${log.service ?: "RADIUS"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(badgeBg)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = log.action ?: (if (isAccept) "Accept" else if (isReject) "Reject" else log.logType ?: "LOG"),
                    color = badgeColor,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
