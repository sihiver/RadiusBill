package com.radiusbill.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryIndigo,
    onPrimary = CardLight,
    primaryContainer = PrimaryIndigoDark,
    onPrimaryContainer = PrimaryIndigoLight,
    secondary = SuccessGreen,
    onSecondary = CardLight,
    background = NeutralDark,
    onBackground = TextPrimaryDark,
    surface = CardDark,
    onSurface = TextPrimaryDark,
    surfaceVariant = BorderDark,
    onSurfaceVariant = TextSecondaryDark,
    error = DangerRed,
    onError = CardLight
)

private val LightColorScheme = lightColorScheme(
    primary = PrimaryIndigo,
    onPrimary = CardLight,
    primaryContainer = PrimaryIndigoLight,
    onPrimaryContainer = PrimaryIndigoDark,
    secondary = SuccessGreen,
    onSecondary = CardLight,
    background = NeutralLight,
    onBackground = TextPrimaryLight,
    surface = CardLight,
    onSurface = TextPrimaryLight,
    surfaceVariant = BorderLight,
    onSurfaceVariant = TextSecondaryLight,
    error = DangerRed,
    onError = CardLight
)

@Composable
fun RadiusBillTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = PrimaryIndigo.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
