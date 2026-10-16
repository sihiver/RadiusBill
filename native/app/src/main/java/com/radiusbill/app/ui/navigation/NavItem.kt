package com.radiusbill.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Router
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Main : Screen("main")
    data object Settings : Screen("settings")
}

sealed class BottomNavItem(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    data object Dashboard : BottomNavItem("dashboard", "Dashboard", Icons.Default.Dashboard)
    data object Voucher : BottomNavItem("voucher", "Voucher", Icons.Default.ConfirmationNumber)
    data object Member : BottomNavItem("member", "Member", Icons.Default.Group)
    data object RouterClient : BottomNavItem("router", "PPPoE", Icons.Default.Router)
    data object Report : BottomNavItem("report", "Laporan", Icons.Default.BarChart)
}
