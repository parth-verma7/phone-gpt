package com.phonegpt.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Environment
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** App-owned resumable files; legacy DownloadManager transfers remain separate. */
internal object ModelTransfers {
  private val lock = Any()
  private val pool = Executors.newCachedThreadPool()
  private class Job { @Volatile var cancelled = false; val done = CountDownLatch(1) }
  private val jobs = ConcurrentHashMap<String, Job>()
  private fun prefs(context: Context) = context.getSharedPreferences("phone_gpt_transfers_v2", Context.MODE_PRIVATE)
  fun read(context: Context, id: String): JSONObject? = synchronized(lock) { prefs(context).getString(id, null)?.let { JSONObject(it) } }
  private fun edit(context: Context, id: String, action: (JSONObject) -> Unit) = synchronized(lock) {
    val row = read(context, id) ?: return@synchronized
    action(row)
    check(prefs(context).edit().putString(id, row.toString()).commit()) { "Could not save download state" }
  }
  private fun file(context: Context, row: JSONObject, partial: Boolean = false): File {
    val name = row.getString("fileName")
    require(Regex("[A-Za-z0-9][A-Za-z0-9._-]{0,199}").matches(name) && !name.contains(".."))
    val directory = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: throw IOException("Storage unavailable"), "models").apply { mkdirs() }
    return File(directory, name + if (partial) ".part" else "")
  }
  fun online(context: Context): Boolean {
    val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    return manager.getNetworkCapabilities(manager.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
  }
  fun enqueue(context: Context, id: String, url: String, name: String): WritableMap {
    synchronized(lock) {
      val old = read(context, id)
      if (old == null) {
        for (key in prefs(context).all.keys) require(read(context, key)?.getString("fileName") != name) { "Filename belongs to another model" }
        val row = JSONObject().put("url", url).put("fileName", name).put("status", "pending").put("manual", false).put("bytes", 0).put("total", -1)
        // Validate destination before recording a task.
        file(context, row)
        check(prefs(context).edit().putString(id, row.toString()).commit())
      } else if (old.optString("status") == "failed") edit(context, id) { it.put("status", "pending").put("manual", false).remove("error") }
    }
    val row = read(context, id)!!
    if (!row.optBoolean("manual") && row.optString("status") != "completed") start(context)
    return state(context, id)
  }
  fun start(context: Context) { ContextCompat.startForegroundService(context, Intent(context, PhoneGptTransferService::class.java)) }
  fun recover(context: Context, id: String) {
    val row = read(context, id) ?: return
    if (jobs[id] == null && !row.optBoolean("manual") && row.optString("status") in listOf("pending", "running", "paused")) {
      // Background-start restrictions may defer recovery until the app is opened.
      try { start(context) } catch (_: IllegalStateException) {
        edit(context, id) { it.put("status", "failed").put("error", "Android could not restart this download. Open the app and retry.") }
      }
    }
  }
  fun state(context: Context, id: String): WritableMap {
    val row = read(context, id) ?: return Arguments.createMap().apply { putString("status", "none"); putDouble("progress", 0.0) }
    var status = row.optString("status", "pending")
    var reason: String? = null
    if (status == "completed" && (!file(context, row).isFile || file(context, row).length() != row.optLong("bytes"))) {
      edit(context, id) { it.put("status", "failed").put("error", "Model file is missing. Download it again.") }; status = "failed"
    }
    if (row.optBoolean("manual") && status != "completed") { status = "paused"; reason = "manual" }
    else if (status in listOf("pending", "running", "paused")) {
      if (!online(context)) { status = "paused"; reason = "network" }
      else if (status == "paused") reason = "retry"
    }
    val total = row.optLong("total", -1)
    val progress = if (status == "completed") 1.0 else if (total > 0) (row.optLong("bytes").toDouble() / total).coerceIn(0.0, 0.999999) else 0.0
    return Arguments.createMap().apply {
      putString("status", status); putDouble("progress", progress); putBoolean("canPause", true)
      reason?.let { putString("pauseReason", it) }
      if (status == "completed") putString("uri", Uri.fromFile(file(context, row)).toString())
      row.optString("error").takeIf { it.isNotEmpty() }?.let { putString("error", it) }
    }
  }
  fun pause(context: Context, id: String): WritableMap {
    val row = read(context, id) ?: throw IOException("Download not found")
    if (row.optString("status") == "completed") return state(context, id)
    edit(context, id) { if (it.optString("status") != "completed") it.put("manual", true) }
    check(jobs[id]?.done?.await(25, TimeUnit.SECONDS) != false) { "Download is still stopping. Try again." }
    return state(context, id)
  }
  fun resume(context: Context, id: String): WritableMap {
    require(read(context, id) != null) { "Download not found" }
    edit(context, id) { it.put("manual", false); if (it.optString("status") != "completed") it.put("status", "pending").remove("error") }
    start(context)
    return state(context, id)
  }
  fun remove(context: Context, id: String): Boolean {
    val row = read(context, id) ?: return false
    val job = jobs[id]
    job?.cancelled = true
    edit(context, id) { it.put("manual", true) }
    check(job?.done?.await(25, TimeUnit.SECONDS) != false) { "Download is still stopping. Try again." }
    for (target in listOf(file(context, row), file(context, row, true))) check(!target.exists() || target.delete()) { "Could not remove model file" }
    check(prefs(context).edit().remove(id).commit())
    return true
  }
  fun launch(service: PhoneGptTransferService, finished: () -> Unit) {
    for (id in prefs(service).all.keys) {
      val row = read(service, id) ?: continue
      if (row.optBoolean("manual") || row.optString("status") in listOf("completed", "failed")) continue
      val job = Job()
      if (jobs.putIfAbsent(id, job) != null) continue
      pool.execute {
        try {
          var failures = 0
          while (!job.cancelled && read(service, id)?.optBoolean("manual") == false) {
            if (!online(service)) { edit(service, id) { it.put("status", "paused") }; Thread.sleep(1000); continue }
            try {
              edit(service, id) { it.put("status", "running").remove("error") }
              val current = read(service, id) ?: break
              val partial = file(service, current, true)
              ResumableModelTransfer.download(current.getString("url"), partial, current.optString("validator").takeIf { it.isNotEmpty() }, object : ResumableModelTransfer.Control {
                override fun stopped() = job.cancelled || read(service, id)?.optBoolean("manual") != false
                override fun progress(bytes: Long, total: Long, validator: String?) {
                  edit(service, id) { it.put("bytes", bytes).put("total", total).put("validator", validator ?: "") }
                }
              })
              if (job.cancelled || read(service, id)?.optBoolean("manual") != false) break
              synchronized(lock) {
                // Completion and manual pause must not strand a finalized file
                // in a paused state with no partial file left to resume.
                if (!job.cancelled && read(service, id)?.optBoolean("manual") == false) {
                  check(partial.renameTo(file(service, current))) { "Could not finish saving the model" }
                  edit(service, id) { it.put("status", "completed").put("manual", false).put("bytes", file(service, current).length()) }
                }
              }
              break
            } catch (_: ResumableModelTransfer.Stopped) { break }
            catch (error: ResumableModelTransfer.ProtocolFailure) {
              if (job.cancelled || read(service, id)?.optBoolean("manual") != false) break
              edit(service, id) { it.put("status", "failed").put("error", error.message) }; break
            }
            catch (error: ResumableModelTransfer.HttpFailure) {
              if (job.cancelled || read(service, id)?.optBoolean("manual") != false) break
              if ((error.status in listOf(408, 429) || error.status >= 500) && ++failures < 5) { edit(service, id) { it.put("status", "paused") }; Thread.sleep(10000) }
              else { edit(service, id) { it.put("status", "failed").put("error", error.message) }; break }
            } catch (error: IOException) {
              if (job.cancelled || read(service, id)?.optBoolean("manual") != false) break
              // Bound retries while preserving the checkpoint for an explicit retry.
              failures++
              if (file(service, row, true).parentFile!!.usableSpace < 65536 || failures >= 5) {
                edit(service, id) { it.put("status", "failed").put("error", if (file(service, row, true).parentFile!!.usableSpace < 65536) "Not enough storage. Free space and retry." else "Download interrupted. Retry to continue from the saved checkpoint.") }
                break
              }
              edit(service, id) { it.put("status", "paused") }
              Thread.sleep(3000)
            }
          }
        } catch (error: Exception) { edit(service, id) { it.put("status", "failed").put("error", error.message ?: "Download failed") } }
        finally { jobs.remove(id, job); job.done.countDown(); finished() }
      }
    }
  }
  fun stopForTimeout(context: Context, message: String = "Android stopped background downloading. Open the app and retry to continue.") {
    for (id in prefs(context).all.keys) {
      jobs[id]?.cancelled = true
      val row = read(context, id) ?: continue
      if (!row.optBoolean("manual") && row.optString("status") !in listOf("completed", "failed")) {
        edit(context, id) { it.put("status", "failed").put("error", message) }
      }
    }
  }
  fun idle() = jobs.isEmpty()
}

class PhoneGptTransferService : Service() {
  @Volatile private var lastStart = 0
  override fun onBind(intent: Intent?) = null
  override fun onTimeout(startId: Int, fgsType: Int) {
    // Android imposes background data-sync time limits; retain files for retry.
    ModelTransfers.stopForTimeout(this)
    stopSelf(startId)
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    lastStart = startId
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel("model_downloads", "Model downloads", NotificationManager.IMPORTANCE_LOW))
    val notification = NotificationCompat.Builder(this, "model_downloads").setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle("PhoneGPT model downloads").setContentText("Downloading models for offline use")
      .setOngoing(true).setContentIntent(PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)).build()
    try { startForeground(2404, notification) }
    catch (_: Exception) {
      ModelTransfers.stopForTimeout(this, "Android could not start background downloading. Open the app and retry.")
      stopSelf(startId)
      return START_NOT_STICKY
    }
    ModelTransfers.launch(this) { if (ModelTransfers.idle()) stopSelf(lastStart) }
    if (ModelTransfers.idle()) stopSelf(startId)
    return START_STICKY
  }
}
