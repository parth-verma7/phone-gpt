package com.phonegpt.app

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.net.Uri
import android.os.SystemClock
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.RandomAccessFile
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.log10
import kotlin.math.sqrt

/** Foreground-only 16 kHz mono PCM recording. The WAV is private and temporary. */
class PhoneGptRecorderModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), LifecycleEventListener {
  private val worker = Executors.newSingleThreadExecutor()
  @Volatile private var recording = false
  private var recorder: AudioRecord? = null
  private var thread: Thread? = null
  private var file: File? = null
  @Volatile private var failure: Throwable? = null
  @Volatile private var capturedBytes = 0

  init { context.addLifecycleEventListener(this) }
  override fun getName() = "PhoneGptRecorder"

  @ReactMethod
  fun start(promise: Promise) { worker.execute {
    try {
      check(thread == null) { "A recording is already active" }
      check(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
        "Microphone permission is required"
      }
      val directory = File(context.cacheDir, "voice").apply { mkdirs() }
      directory.listFiles()?.forEach { it.delete() }
      val output = File(directory, "${UUID.randomUUID()}.wav")
      val minimum = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      check(minimum > 0) { "This device cannot record 16 kHz audio" }
      val size = maxOf(minimum * 2, 4096)
      val audio = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000,
        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, size)
      recorder = audio
      check(audio.state == AudioRecord.STATE_INITIALIZED) { "Could not initialize microphone" }
      file = output
      failure = null
      capturedBytes = 0
      audio.startRecording()
      check(audio.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "Microphone could not start" }
      recording = true
      thread = Thread({
        try {
          RandomAccessFile(output, "rw").use { wav ->
            wav.write(ByteArray(44))
            val buffer = ByteArray(size)
            var written = 0
            var lastLevelEvent = 0L
            while (recording) {
              val count = audio.read(buffer, 0, buffer.size)
              if (count < 0 && recording) error("Microphone read failed: $count")
              if (count <= 0) break
              wav.write(buffer, 0, count)
              written += count
              capturedBytes = written
              val now = SystemClock.elapsedRealtime()
              if (recording && now - lastLevelEvent >= 80) {
                lastLevelEvent = now
                var energy = 0.0
                val samples = count / 2
                for (index in 0 until samples) {
                  val offset = index * 2
                  val sample = ((buffer[offset].toInt() and 255) or (buffer[offset + 1].toInt() shl 8)).toShort().toDouble() / 32768.0
                  energy += sample * sample
                }
                val rms = if (samples > 0) sqrt(energy / samples) else 0.0
                // A small noise floor leaves the meter empty during silence.
                val db = 20.0 * log10(maxOf(rms, 1e-9))
                val level = ((db + 52.0) / 42.0).coerceIn(0.0, 1.0)
                try {
                  context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("PhoneGptAudioLevel", Arguments.createMap().apply { putDouble("level", level) })
                } catch (_: Exception) { /* React may be closing; recording cleanup still runs. */ }
              }
            }
            wav.seek(0)
            fun le(value: Int, bytes: Int) { repeat(bytes) { wav.write((value ushr (it * 8)) and 255) } }
            wav.writeBytes("RIFF"); le(written + 36, 4); wav.writeBytes("WAVEfmt ")
            le(16, 4); le(1, 2); le(1, 2); le(16000, 4); le(32000, 4)
            le(2, 2); le(16, 2); wav.writeBytes("data"); le(written, 4)
          }
        } catch (error: Throwable) { failure = error }
        finally {
          recording = false
          try { audio.stop() } catch (_: Exception) {}
          audio.release()
        }
      }, "PhoneGPT-Microphone").apply { start() }
      promise.resolve(Uri.fromFile(output).toString())
    } catch (error: Throwable) {
      recording = false
      try { recorder?.release() } catch (_: Exception) {}
      recorder = null
      file?.delete(); file = null
      promise.reject("VOICE_RECORDING", error.message, error)
    }
  } }

  private fun finish(discard: Boolean): File? {
    recording = false
    val capture = thread
    if (capture?.isAlive == true) {
      // Unblock a read before waiting for the WAV header and file close.
      try { recorder?.stop() } catch (_: Exception) {}
      capture.join(3000)
      check(!capture.isAlive) { "Microphone did not stop" }
    }
    thread = null; recorder = null
    val output = file
    file = null
    if (discard) { output?.delete(); return null }
    failure?.let { output?.delete(); throw it }
    return output
  }

  @ReactMethod
  fun snapshot(uri: String, startSample: Double, maxSamples: Double, promise: Promise) { worker.execute {
    var output: File? = null
    try {
      val directory = File(context.cacheDir, "voice").canonicalFile
      val source = File(Uri.parse(uri).path ?: "").canonicalFile
      check(source.parentFile == directory && source.extension == "wav") { "Invalid recording" }
      check(startSample.isFinite() && maxSamples.isFinite()) { "Invalid audio range" }
      val available = if (source == file?.canonicalFile) capturedBytes else maxOf(0L, source.length() - 44).toInt()
      val start = startSample.toInt().coerceIn(0, available / 2)
      val count = minOf(available / 2 - start, maxSamples.toInt().coerceIn(1, 12 * 16000))
      val result = Arguments.createMap().apply {
        putNull("uri"); putInt("sampleCount", count); putInt("endSample", start + count); putBoolean("hasSpeech", false)
      }
      if (count > 0) {
        val pcm = ByteArray(count * 2)
        RandomAccessFile(source, "r").use { input -> input.seek(44L + start * 2L); input.readFully(pcm) }
        // Energy gate only: avoid decoding silence, without another VAD model.
        var activeFrames = 0
        var energy = 0.0
        for (index in 0 until count) {
          val offset = index * 2
          val sample = ((pcm[offset].toInt() and 255) or (pcm[offset + 1].toInt() shl 8)).toShort().toDouble() / 32768.0
          energy += sample * sample
          if ((index + 1) % 320 == 0) {
            if (sqrt(energy / 320) > 0.0025) activeFrames++
            energy = 0.0
          }
        }
        output = File(directory, "slice-${UUID.randomUUID()}.wav")
        RandomAccessFile(output, "rw").use { wav ->
          fun le(value: Int, bytes: Int) { repeat(bytes) { wav.write((value ushr (it * 8)) and 255) } }
          wav.writeBytes("RIFF"); le(pcm.size + 36, 4); wav.writeBytes("WAVEfmt ")
          le(16, 4); le(1, 2); le(1, 2); le(16000, 4); le(32000, 4)
          le(2, 2); le(16, 2); wav.writeBytes("data"); le(pcm.size, 4); wav.write(pcm)
        }
        result.putString("uri", Uri.fromFile(output).toString())
        result.putBoolean("hasSpeech", activeFrames >= 2)
      }
      promise.resolve(result)
    } catch (error: Throwable) {
      output?.delete()
      promise.reject("VOICE_SNAPSHOT", error.message, error)
    }
  } }

  @ReactMethod
  fun stop(promise: Promise) { worker.execute {
    try {
      val output = finish(false)
      check(output != null && output.length() > 44) { "No audio was recorded. Please try again." }
      promise.resolve(Uri.fromFile(output).toString())
    } catch (error: Throwable) { promise.reject("VOICE_RECORDING", error.message, error) }
  } }

  @ReactMethod
  fun cancel(promise: Promise) { worker.execute {
    try { finish(true); promise.resolve(true) }
    catch (error: Throwable) { promise.reject("VOICE_RECORDING", error.message, error) }
  } }
  override fun onHostResume() {}
  override fun onHostPause() { worker.execute { try { finish(true) } catch (_: Throwable) {} } }
  override fun onHostDestroy() { worker.execute { try { finish(true) } catch (_: Throwable) {} } }
  override fun invalidate() {
    context.removeLifecycleEventListener(this)
    worker.execute { try { finish(true) } catch (_: Throwable) {} }
    worker.shutdown()
    super.invalidate()
  }
}
