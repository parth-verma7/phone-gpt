package com.phonegpt.app

import android.app.DownloadManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Environment
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.IOException
import java.util.concurrent.Executors
import org.json.JSONObject

/**
 * System-owned downloads survive backgrounding, task dismissal and ordinary process death.
 * Android force-stop can suspend work; uninstall removes app data and model files.
 * Poll getState on reopen. Progress is a fraction (0..1); uri exists only for completed files.
 * No JS service, Activity, receiver, or storage runtime permission is needed.
 */
class PhoneGptDownloadsModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  private val preferences = context.getSharedPreferences("phone_gpt_downloads_v1", Context.MODE_PRIVATE)
  private val manager: DownloadManager
    get() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  // Shared across bridge reloads, so old and new module instances cannot race each other.
  companion object {
    private val worker = Executors.newSingleThreadExecutor()
    private val safeFileName = Regex("[A-Za-z0-9][A-Za-z0-9._-]{0,199}")
  }

  private data class Record(val modelId: String, val url: String, val fileName: String, val id: Long)
  private data class State(
    val status: String,
    val progress: Double = 0.0,
    val uri: String? = null,
    val error: String? = null,
    val pauseReason: String? = null,
  ) {
    fun toMap(): WritableMap = Arguments.createMap().apply {
      putString("status", status)
      putDouble("progress", progress)
      putBoolean("canPause", false)
      uri?.let { putString("uri", it) }
      error?.let { putString("error", it) }
      pauseReason?.let { putString("pauseReason", it) }
    }
  }

  override fun getName() = "PhoneGptDownloads"

  @ReactMethod
  fun getNetworkStatus(promise: Promise) {
    try {
      val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
      promise.resolve(Arguments.createMap().apply {
        putBoolean("online", capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true)
        putBoolean("metered", connectivity.isActiveNetworkMetered)
      })
    } catch (error: Exception) {
      promise.reject("E_NETWORK_STATUS", "Could not check the connection", error)
    }
  }


  private fun execute(promise: Promise, action: () -> Any?) {
    worker.execute {
      try {
        promise.resolve(action())
      } catch (error: Exception) {
        promise.reject("E_PHONE_GPT_DOWNLOAD", error.message ?: "Download operation failed", error)
      }
    }
  }

  private fun validateModelId(modelId: String) {
    require(modelId.isNotBlank() && modelId.length <= 512) { "Invalid modelId" }
  }

  private fun destination(fileName: String): File {
    require(safeFileName.matches(fileName) && !fileName.contains("..")) {
      "fileName must be a plain filename (letters, digits, dots, underscores or hyphens; max 200 characters)"
    }
    val base = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
      ?: throw IOException("App external downloads storage is unavailable")
    val directory = File(base, "models")
    if (!directory.isDirectory && !directory.mkdirs()) {
      throw IOException("Cannot create models download directory")
    }
    val file = File(directory, fileName)
    require(file.canonicalFile.parentFile == directory.canonicalFile) { "Unsafe download destination" }
    return file
  }

  private fun read(modelId: String): Record? {
    val raw = preferences.getString(modelId, null) ?: return null
    val json = JSONObject(raw)
    return Record(modelId, json.getString("url"), json.getString("fileName"), json.getLong("id"))
  }

  private fun save(record: Record) {
    val json = JSONObject().apply {
      put("url", record.url)
      put("fileName", record.fileName)
      put("id", record.id)
    }
    check(preferences.edit().putString(record.modelId, json.toString()).commit()) {
      "Could not persist download metadata"
    }
  }

  /** Recover the small window between system enqueue and saving its returned ID. */
  private fun recover(record: Record): Record {
    if (record.id > 0) return record
    val expectedUri = Uri.fromFile(destination(record.fileName)).toString()
    val cursor = manager.query(DownloadManager.Query())
      ?: throw IOException("Cannot query Android DownloadManager")
    cursor.use {
      val localUri = it.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI)
      val sourceUri = it.getColumnIndexOrThrow(DownloadManager.COLUMN_URI)
      val idColumn = it.getColumnIndexOrThrow(DownloadManager.COLUMN_ID)
      while (it.moveToNext()) {
        if (it.getString(localUri) == expectedUri && it.getString(sourceUri) == record.url) {
          val recovered = record.copy(id = it.getLong(idColumn))
          save(recovered)
          return recovered
        }
      }
    }
    return record
  }

  private fun state(record: Record): State {
    val file = destination(record.fileName)
    if (record.id <= 0) return State("failed", error = "Download was interrupted before it was scheduled")
    val cursor = manager.query(DownloadManager.Query().setFilterById(record.id))
      ?: throw IOException("Cannot query Android DownloadManager")
    cursor.use {
      if (!it.moveToFirst()) return State("failed", error = "Download is missing from Android DownloadManager")
      val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      val downloaded = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
      val total = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
      // Reserve 1 for verified completion, even when all bytes arrived before the status changed.
      val progress = if (total > 0) (downloaded.toDouble() / total).coerceIn(0.0, 0.999999) else 0.0
      val reason = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
      return when (status) {
        DownloadManager.STATUS_PENDING -> State("pending", progress)
        DownloadManager.STATUS_RUNNING -> State("running", progress)
        DownloadManager.STATUS_PAUSED -> State("paused", progress, pauseReason = if (!ModelTransfers.online(context)) "network" else "retry")
        DownloadManager.STATUS_SUCCESSFUL -> {
          if (file.isFile && file.length() > 0 && (total <= 0 || file.length() == total)) {
            State("completed", 1.0, Uri.fromFile(file).toString())
          } else {
            State("failed", error = "Downloaded model file is missing, empty or incomplete")
          }
        }
        DownloadManager.STATUS_FAILED -> State("failed", progress, error = failureReason(reason))
        else -> State("failed", error = "Unknown DownloadManager status: $status")
      }
    }
  }

  private fun failureReason(reason: Int): String = when (reason) {
    DownloadManager.ERROR_CANNOT_RESUME -> "Download cannot resume"
    DownloadManager.ERROR_DEVICE_NOT_FOUND -> "Download storage is unavailable"
    DownloadManager.ERROR_FILE_ALREADY_EXISTS -> "Download destination already exists"
    DownloadManager.ERROR_FILE_ERROR -> "Could not write model file"
    DownloadManager.ERROR_HTTP_DATA_ERROR -> "Network error while downloading model"
    DownloadManager.ERROR_INSUFFICIENT_SPACE -> "Not enough storage for model"
    DownloadManager.ERROR_TOO_MANY_REDIRECTS -> "Too many download redirects"
    DownloadManager.ERROR_UNHANDLED_HTTP_CODE -> "Unsupported HTTP response"
    else -> if (reason in 400..599) "Download HTTP error $reason" else "Download failed (reason $reason)"
  }

  private fun remove(record: Record) {
    val recovered = recover(record)
    if (recovered.id > 0) manager.remove(recovered.id)
    val file = destination(recovered.fileName)
    if (file.exists() && !file.delete()) throw IOException("Could not delete model file")
    check(preferences.edit().remove(record.modelId).commit()) { "Could not remove download metadata" }
  }

  @ReactMethod
  fun enqueue(modelId: String, url: String, fileName: String, promise: Promise) = execute(promise) {
    validateModelId(modelId)
    val target = destination(fileName)
    val uri = Uri.parse(url)
    require((uri.scheme == "https" || uri.scheme == "http") && !uri.host.isNullOrBlank()) {
      "Download URL must be HTTP or HTTPS"
    }
    if (ModelTransfers.read(context, modelId) != null) return@execute ModelTransfers.enqueue(context, modelId, url, fileName)
    val existing = read(modelId)?.let { recover(it) }
    if (existing != null) {
      val current = state(existing)
      if (current.status != "failed") return@execute current.toMap()
    }
    for (key in preferences.all.keys) {
      if (key != modelId && read(key)?.fileName == fileName) throw IllegalArgumentException("Filename belongs to another model")
    }
    if (existing != null) remove(existing)
    if (target.exists() && !target.delete()) throw IOException("Could not remove stale model file")
    ModelTransfers.enqueue(context, modelId, url, fileName)
  }

  @ReactMethod
  fun pause(modelId: String, promise: Promise) = execute(promise) {
    validateModelId(modelId)
    check(ModelTransfers.read(context, modelId) != null) { "This transfer started in an older version. Let it finish, or cancel and start again to enable Pause." }
    ModelTransfers.pause(context, modelId)
  }

  @ReactMethod
  fun resume(modelId: String, promise: Promise) = execute(promise) {
    validateModelId(modelId)
    ModelTransfers.resume(context, modelId)
  }

  @ReactMethod
  fun getState(modelId: String, promise: Promise) = execute(promise) {
    validateModelId(modelId)
    if (ModelTransfers.read(context, modelId) != null) {
      ModelTransfers.recover(context, modelId)
      return@execute ModelTransfers.state(context, modelId)
    }
    val record = read(modelId)
    (if (record == null) State("none") else state(recover(record))).toMap()
  }

  @ReactMethod
  fun cancel(modelId: String, promise: Promise) = execute(promise) {
    validateModelId(modelId)
    if (ModelTransfers.read(context, modelId) != null) return@execute ModelTransfers.remove(context, modelId)
    val record = read(modelId)
    if (record == null) false else {
      remove(record)
      true
    }
  }

  @ReactMethod
  fun delete(modelId: String, promise: Promise) = execute(promise) {
    validateModelId(modelId)
    if (ModelTransfers.read(context, modelId) != null) ModelTransfers.remove(context, modelId)
    else read(modelId)?.let { remove(it) }
    null
  }
}
