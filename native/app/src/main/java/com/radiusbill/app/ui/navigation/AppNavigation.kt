package com.radiusbill.app.ui.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import com.radiusbill.app.data.local.PreferencesManager
import com.radiusbill.app.ui.components.RadiusBillTopAppBar
import com.radiusbill.app.ui.screens.dashboard.DashboardScreen
import com.radiusbill.app.ui.screens.login.LoginScreen
import com.radiusbill.app.ui.screens.member.MemberScreen
import com.radiusbill.app.ui.screens.report.ReportScreen
import com.radiusbill.app.ui.screens.router.RouterScreen
import com.radiusbill.app.ui.screens.settings.SettingsScreen
import com.radiusbill.app.ui.screens.voucher.VoucherScreen
import com.radiusbill.app.ui.theme.PrimaryIndigo

@Composable
fun AppNavigation() {
    val context = LocalContext.current
    val prefs = remember { PreferencesManager(context) }
    val rootNavController = rememberNavController()

    val startDestination = if (prefs.isLoggedIn) Screen.Main.route else Screen.Login.route

    NavHost(
        navController = rootNavController,
        startDestination = startDestination
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    rootNavController.navigate(Screen.Main.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Main.route) {
            MainContainerScreen(
                onNavigateToSettings = {
                    rootNavController.navigate(Screen.Settings.route)
                },
                onLogout = {
                    prefs.clearAuth()
                    rootNavController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Main.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Settings.route) {
            SettingsScreen(
                onNavigateBack = {
                    rootNavController.popBackStack()
                }
            )
        }
    }
}

@Composable
fun MainContainerScreen(
    onNavigateToSettings: () -> Unit,
    onLogout: () -> Unit
) {
    val tabNavController = rememberNavController()
    val navBackStackEntry by tabNavController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: BottomNavItem.Dashboard.route

    var searchQuery by remember { mutableStateOf("") }
    var isSearchActive by remember { mutableStateOf(false) }

    val bottomNavItems = listOf(
        BottomNavItem.Dashboard,
        BottomNavItem.Voucher,
        BottomNavItem.Member,
        BottomNavItem.RouterClient,
        BottomNavItem.Report
    )

    Scaffold(
        topBar = {
            RadiusBillTopAppBar(
                searchQuery = searchQuery,
                onSearchQueryChange = { searchQuery = it },
                isSearchActive = isSearchActive,
                onToggleSearch = {
                    isSearchActive = !isSearchActive
                    if (!isSearchActive) searchQuery = ""
                },
                onNavigateToSettings = onNavigateToSettings,
                onLogout = onLogout
            )
        },
        bottomBar = {
            val isDark = isSystemInDarkTheme()
            val unselectedNavColor = if (isDark) Color(0xFFCBD5E1) else Color(0xFF64748B)
            val selectedNavColor = if (isDark) Color(0xFF818CF8) else PrimaryIndigo

            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                bottomNavItems.forEach { item ->
                    val isSelected = currentRoute == item.route
                    NavigationBarItem(
                        icon = { Icon(item.icon, contentDescription = item.title) },
                        label = {
                            Text(
                                text = item.title,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 10.5.sp,
                                maxLines = 1,
                                softWrap = false
                            )
                        },
                        selected = isSelected,
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = selectedNavColor,
                            selectedTextColor = selectedNavColor,
                            indicatorColor = selectedNavColor.copy(alpha = if (isDark) 0.20f else 0.12f),
                            unselectedIconColor = unselectedNavColor,
                            unselectedTextColor = unselectedNavColor
                        ),
                        onClick = {
                            if (currentRoute != item.route) {
                                tabNavController.navigate(item.route) {
                                    popUpTo(tabNavController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        }
                    )
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = tabNavController,
            startDestination = BottomNavItem.Dashboard.route,
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            composable(BottomNavItem.Dashboard.route) {
                DashboardScreen()
            }
            composable(BottomNavItem.Voucher.route) {
                VoucherScreen(searchQuery = searchQuery)
            }
            composable(BottomNavItem.Member.route) {
                MemberScreen(searchQuery = searchQuery)
            }
            composable(BottomNavItem.RouterClient.route) {
                RouterScreen(searchQuery = searchQuery)
            }
            composable(BottomNavItem.Report.route) {
                ReportScreen(searchQuery = searchQuery)
            }
        }
    }
}
