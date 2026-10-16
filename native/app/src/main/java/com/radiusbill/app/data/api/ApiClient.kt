package com.radiusbill.app.data.api

import android.content.Context
import com.radiusbill.app.data.local.PreferencesManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class ApiClient private constructor(private val context: Context) {

    private val prefs = PreferencesManager(context)
    private var currentBaseUrl: String = ""
    private var apiServiceInstance: ApiService? = null

    companion object {
        @Volatile
        private var INSTANCE: ApiClient? = null

        fun getInstance(context: Context): ApiClient {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: ApiClient(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    private fun getBaseUrlFormatted(): String {
        var url = prefs.baseUrl.trim()
        if (!url.endsWith("/")) {
            url += "/"
        }
        return url
    }

    private val authInterceptor = Interceptor { chain ->
        val originalRequest = chain.request()
        val builder = originalRequest.newBuilder()
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")

        val token = prefs.authToken
        if (!token.isNullOrBlank()) {
            builder.header("Authorization", "Bearer $token")
        }

        val response = chain.proceed(builder.build())

        if (response.code == 401) {
            // Session expired or invalid
            prefs.clearAuth()
        }

        response
    }

    private val okHttpClient: OkHttpClient by lazy {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    val apiService: ApiService
        get() {
            val formattedUrl = getBaseUrlFormatted()
            if (apiServiceInstance == null || currentBaseUrl != formattedUrl) {
                currentBaseUrl = formattedUrl
                val retrofit = Retrofit.Builder()
                    .baseUrl(formattedUrl)
                    .client(okHttpClient)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build()
                apiServiceInstance = retrofit.create(ApiService::class.java)
            }
            return apiServiceInstance!!
        }
}
