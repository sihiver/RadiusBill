package com.radiusbill.app.data.api

import com.radiusbill.app.data.model.*
import retrofit2.http.*

interface ApiService {

    // Auth
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): ApiResponse<LoginData>

    // Vouchers
    @GET("vouchers")
    suspend fun getVouchers(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 25,
        @Query("status") status: String? = null,
        @Query("q") query: String? = null
    ): ApiResponse<List<Voucher>>

    @GET("voucher-logs")
    suspend fun getVoucherLogs(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 25,
        @Query("q") query: String? = null
    ): ApiResponse<List<Voucher>>

    @POST("vouchers/generate")
    suspend fun generateVouchers(@Body request: GenerateVoucherRequest): ApiResponse<Any>

    @PUT("vouchers/{id}")
    suspend fun updateVoucher(
        @Path("id") id: Long,
        @Body request: UpdateVoucherRequest
    ): ApiResponse<Any>

    @PUT("voucher-logs/{id}")
    suspend fun updateVoucherLog(
        @Path("id") id: Long,
        @Body request: UpdateVoucherRequest
    ): ApiResponse<Any>

    // Packages
    @GET("packages")
    suspend fun getPackages(@Query("type") type: String): ApiResponse<List<PackageItem>>

    // Members (Hotspot)
    @GET("members")
    suspend fun getMembers(): ApiResponse<List<Member>>

    @POST("members")
    suspend fun createMember(@Body request: MemberRequest): ApiResponse<Any>

    @PUT("members/{id}")
    suspend fun updateMember(@Path("id") id: Long, @Body request: MemberRequest): ApiResponse<Any>

    @DELETE("members/{id}")
    suspend fun deleteMember(@Path("id") id: Long): ApiResponse<Any>

    @POST("members/{id}/extend")
    suspend fun extendMember(@Path("id") id: Long, @Body request: ExtendMemberRequest): ApiResponse<Any>

    // Routers (PPPoE)
    @GET("routers")
    suspend fun getRouters(): ApiResponse<List<RouterClient>>

    @POST("routers")
    suspend fun createRouter(@Body request: RouterClientRequest): ApiResponse<Any>

    @PUT("routers/{id}")
    suspend fun updateRouter(@Path("id") id: Long, @Body request: RouterClientRequest): ApiResponse<Any>

    @DELETE("routers/{id}")
    suspend fun deleteRouter(@Path("id") id: Long): ApiResponse<Any>

    @POST("routers/{id}/extend")
    suspend fun extendRouter(@Path("id") id: Long, @Body request: ExtendRouterRequest): ApiResponse<Any>

    @POST("routers/{id}/{action}")
    suspend fun toggleIsolir(
        @Path("id") id: Long,
        @Path("action") action: String,
        @Body request: IsolirRequest
    ): ApiResponse<Any>

    // Dashboard
    @GET("dashboard/stats")
    suspend fun getDashboardStats(): ApiResponse<DashboardStatsData>

    @GET("radius/logs")
    suspend fun getRadiusLogs(@Query("limit") limit: Int = 25): ApiResponse<List<RadiusLogRaw>>

    // Reports
    @GET("reports/summary")
    suspend fun getReportSummary(@Query("month") month: String): ApiResponse<ReportSummaryData>

    @GET("reports/revenue")
    suspend fun getReportRevenue(@Query("month") month: String): ApiResponse<List<RevenueItem>>
}
