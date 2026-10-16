package com.radiusbill.app.util

import android.content.Context
import android.content.Intent
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient

object PrintUtils {

    fun shareText(context: Context, title: String, message: String) {
        val sendIntent = Intent().apply {
            action = Intent.ACTION_SEND
            putExtra(Intent.EXTRA_TEXT, message)
            type = "text/plain"
        }
        val shareIntent = Intent.createChooser(sendIntent, title)
        context.startActivity(shareIntent)
    }

    fun printHtmlReceipt(
        context: Context,
        jobName: String,
        htmlContent: String
    ) {
        val webView = WebView(context)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager
                val printAdapter = webView.createPrintDocumentAdapter(jobName)
                val printAttributes = PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A7)
                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                    .build()
                printManager?.print(jobName, printAdapter, printAttributes)
            }
        }
        webView.loadDataWithBaseURL(null, htmlContent, "text/html", "UTF-8", null)
    }

    fun generateVoucherHtml(code: String, packageName: String?): String {
        return """
            <!DOCTYPE html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                <style>
                  @page { margin: 0; size: 58mm auto; }
                  body {
                    margin: 0;
                    padding: 8px;
                    width: 58mm;
                    font-family: monospace;
                    font-size: 12px;
                    color: #000;
                    text-align: center;
                  }
                  h2 { font-size: 15px; margin: 4px 0; }
                  h3 { font-size: 16px; margin: 8px 0; font-weight: bold; border: 1px dashed #000; padding: 6px; }
                  p { margin: 4px 0; }
                  .line { border-top: 1px dashed #000; margin: 8px 0; }
                </style>
              </head>
              <body>
                <h2>RADIUS BILLING</h2>
                <div class="line"></div>
                <p>Voucher Hotspot</p>
                <h3>$code</h3>
                <p>Paket: <b>${packageName ?: "-"}</b></p>
                <div class="line"></div>
                <p style="font-size: 10px;">Gunakan kode di atas untuk login ke jaringan WiFi.</p>
              </body>
            </html>
        """.trimIndent()
    }

    fun generateMemberHtml(username: String, password: String?, packageName: String?): String {
        return """
            <!DOCTYPE html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
                <style>
                  @page { margin: 0; size: 58mm auto; }
                  body {
                    margin: 0;
                    padding: 8px;
                    width: 58mm;
                    font-family: monospace;
                    font-size: 12px;
                    color: #000;
                    text-align: center;
                  }
                  h2 { font-size: 15px; margin: 4px 0; }
                  p { margin: 4px 0; }
                  .line { border-top: 1px dashed #000; margin: 8px 0; }
                  .row { display: flex; justify-content: space-between; text-align: left; margin: 2px 0; }
                </style>
              </head>
              <body>
                <h2>RADIUS BILLING</h2>
                <div class="line"></div>
                <p>Akun Pelanggan</p>
                <div class="row"><span>Username:</span><b>$username</b></div>
                <div class="row"><span>Password:</span><b>${password ?: "******"}</b></div>
                <div class="row"><span>Paket:</span><b>${packageName ?: "-"}</b></div>
                <div class="line"></div>
                <p style="font-size: 10px;">Simpan informasi ini dengan aman.</p>
              </body>
            </html>
        """.trimIndent()
    }
}
