import AVFoundation
import ExpoModulesCore
import UIKit

private enum RecordingError: LocalizedError {
  case invalid(String)
  var errorDescription: String? { if case .invalid(let message) = self { return message }; return nil }
}

/** Same 16 kHz mono PCM/WAV and bounded snapshot contract as Android. */
public final class PhoneGptRecorderModule: Module {
  private let queue = DispatchQueue(label: "PhoneGPT.Microphone")
  private var engine: AVAudioEngine?
  private var converter: AVAudioConverter?
  private var source: URL?
  private var output: FileHandle?
  private var byteCount = 0
  private var generation = UUID()
  private var captureError: Error?
  private var lastLevel = Date.distantPast
  private var backgroundObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("PhoneGptRecorder")
    Events("PhoneGptAudioLevel")
    OnCreate { [weak self] in
      self?.backgroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: nil) { [weak self] _ in
        self?.queue.async { [weak self] in try? self?.finish(discard: true) }
      }
    }
    OnDestroy { [weak self] in
      if let observer = self?.backgroundObserver { NotificationCenter.default.removeObserver(observer) }
      guard let self = self else { return }
      self.queue.async { try? self.finish(discard: true) }
    }
    AsyncFunction("requestPermission") { (promise: Promise) in
      AVAudioSession.sharedInstance().requestRecordPermission { granted in promise.resolve(granted) }
    }
    AsyncFunction("start") { () -> String in try self.startRecording() }.runOnQueue(queue)
    AsyncFunction("stop") { (promise: Promise) in self.endCapture(discard: false, promise: promise) }
    AsyncFunction("cancel") { (promise: Promise) in self.endCapture(discard: true, promise: promise) }
    AsyncFunction("snapshot") { (uri: String, start: Double, maximum: Double) -> [String: Any] in
      try self.snapshot(uri: uri, start: start, maximum: maximum)
    }.runOnQueue(queue)
  }

  private func endCapture(discard: Bool, promise: Promise) {
    queue.async {
      self.engine?.inputNode.removeTap(onBus: 0)
      self.engine?.stop(); self.engine = nil
      // Drain PCM writes queued by the last tap before closing the WAV.
      self.queue.async {
        do {
          let result = try self.finish(discard: discard)
          if discard { promise.resolve(true) }
          else if let result = result, self.byteCount > 0 { promise.resolve(result.absoluteString) }
          else { throw RecordingError.invalid("No audio was recorded. Please try again.") }
        } catch { promise.reject(error) }
      }
    }
  }

  private func directory() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("voice", isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }
  private func startRecording() throws -> String {
    guard engine == nil else { throw RecordingError.invalid("A recording is already active") }
    guard AVAudioSession.sharedInstance().recordPermission == .granted else {
      throw RecordingError.invalid("Microphone permission is required")
    }
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.record, mode: .measurement, options: [])
    try session.setActive(true)
    let directory = try directory()
    for old in try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) where old.pathExtension == "wav" {
      try? FileManager.default.removeItem(at: old)
    }
    let url = directory.appendingPathComponent("\(UUID().uuidString).wav")
    FileManager.default.createFile(atPath: url.path, contents: Self.wavHeader(bytes: 0))
    output = try FileHandle(forWritingTo: url)
    try output?.seekToEnd()
    source = url; byteCount = 0; captureError = nil; generation = UUID()
    let token = generation
    let audio = AVAudioEngine()
    let input = audio.inputNode
    let inputFormat = input.outputFormat(forBus: 0)
    guard inputFormat.sampleRate > 0,
      let target = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true),
      let convert = AVAudioConverter(from: inputFormat, to: target) else {
      _ = try? finish(discard: true)
      throw RecordingError.invalid("This microphone format cannot be converted to 16 kHz audio")
    }
    converter = convert; engine = audio
    input.installTap(onBus: 0, bufferSize: 2048, format: inputFormat) { [weak self] buffer, _ in
      let capacity = AVAudioFrameCount(ceil(Double(buffer.frameLength) * 16000 / inputFormat.sampleRate) + 64)
      guard let converted = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }
      var supplied = false
      var error: NSError?
      let status = convert.convert(to: converted, error: &error) { _, state in
        if supplied { state.pointee = .noDataNow; return nil }
        supplied = true; state.pointee = .haveData; return buffer
      }
      guard status != .error, error == nil, let samples = converted.int16ChannelData?[0] else {
        self?.queue.async { [weak self] in self?.captureError = error ?? RecordingError.invalid("Microphone conversion failed") as NSError }
        return
      }
      let data = Data(bytes: samples, count: Int(converted.frameLength) * 2)
      self?.queue.async { [weak self] in
        guard let self = self, self.generation == token, let handle = self.output else { return }
        do {
          guard self.byteCount + data.count <= Int(UInt32.max) - 36 else { throw RecordingError.invalid("Recording reached the WAV file size limit") }
          try handle.write(contentsOf: data); self.byteCount += data.count
          if Date().timeIntervalSince(self.lastLevel) >= 0.08 {
            self.lastLevel = Date()
            let rms = Self.rms(data)
            let level = min(1, max(0, (20 * log10(max(rms, 1e-9)) + 52) / 42))
            self.sendEvent("PhoneGptAudioLevel", ["level": level])
          }
        } catch { self.captureError = error }
      }
    }
    do { audio.prepare(); try audio.start() }
    catch { _ = try? finish(discard: true); throw error }
    return url.absoluteString
  }

  @discardableResult private func finish(discard: Bool) throws -> URL? {
    generation = UUID()
    engine?.inputNode.removeTap(onBus: 0); engine?.stop(); engine = nil; converter = nil
    let result = source; source = nil
    if let handle = output {
      try? handle.seek(toOffset: 0)
      try? handle.write(contentsOf: Self.wavHeader(bytes: byteCount))
      try? handle.close()
    }
    output = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    if discard || captureError != nil {
      if let url = result { try? FileManager.default.removeItem(at: url) }
      if !discard, let error = captureError { captureError = nil; throw error }
      captureError = nil
      return nil
    }
    return result
  }
  private func snapshot(uri: String, start: Double, maximum: Double) throws -> [String: Any] {
    let base = try directory().resolvingSymlinksInPath()
    guard let url = URL(string: uri), url.isFileURL,
      url.deletingLastPathComponent().resolvingSymlinksInPath() == base, url.pathExtension == "wav",
      start.isFinite, maximum.isFinite, start >= 0, maximum >= 1 else { throw RecordingError.invalid("Invalid recording or audio range") }
    let info = try FileManager.default.attributesOfItem(atPath: url.path)
    let available = url == source ? byteCount / 2 : max(0, ((info[.size] as? NSNumber)?.intValue ?? 44) - 44) / 2
    let offset = Int(min(Double(available), start))
    let count = min(available - offset, Int(min(maximum, 192000)))
    guard count > 0 else { return ["uri": NSNull(), "sampleCount": 0, "endSample": offset, "hasSpeech": false] }
    let file = try FileHandle(forReadingFrom: url); defer { try? file.close() }
    try file.seek(toOffset: UInt64(44 + offset * 2))
    guard let pcm = try file.read(upToCount: count * 2), pcm.count == count * 2 else { throw RecordingError.invalid("Could not read recorded audio") }
    var activeFrames = 0
    for index in stride(from: 0, through: max(0, pcm.count - 640), by: 640) where index + 640 <= pcm.count {
      if Self.rms(pcm.subdata(in: index..<(index + 640))) > 0.0025 { activeFrames += 1 }
    }
    let slice = base.appendingPathComponent("slice-\(UUID().uuidString).wav")
    try (Self.wavHeader(bytes: pcm.count) + pcm).write(to: slice, options: .atomic)
    return ["uri": slice.absoluteString, "sampleCount": count, "endSample": offset + count, "hasSpeech": activeFrames >= 2]
  }
  private static func rms(_ pcm: Data) -> Double {
    guard pcm.count >= 2 else { return 0 }
    var energy = 0.0
    for index in stride(from: 0, to: pcm.count - 1, by: 2) {
      let bits = UInt16(pcm[index]) | UInt16(pcm[index + 1]) << 8
      let value = Double(Int16(bitPattern: bits)) / 32768
      energy += value * value
    }
    return sqrt(energy / Double(pcm.count / 2))
  }
  private static func wavHeader(bytes: Int) -> Data {
    var data = Data()
    func text(_ value: String) { data.append(contentsOf: value.utf8) }
    func little(_ value: UInt32, _ count: Int) { for index in 0..<count { data.append(UInt8((value >> (index * 8)) & 255)) } }
    text("RIFF"); little(UInt32(bytes + 36), 4); text("WAVEfmt "); little(16, 4)
    little(1, 2); little(1, 2); little(16000, 4); little(32000, 4); little(2, 2); little(16, 2)
    text("data"); little(UInt32(bytes), 4)
    return data
  }
}
