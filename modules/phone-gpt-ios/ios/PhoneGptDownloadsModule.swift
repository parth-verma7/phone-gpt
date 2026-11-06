import ExpoModulesCore
import Foundation
import Network
import UIKit

private struct Transfer: Codable {
  var id: String
  var source: String
  var fileName: String
  var token = UUID().uuidString
  var status = "pending"
  var written: Int64 = 0
  var expected: Int64 = 0
  var pauseReason: String?
  var error: String?
  var lastSaved: TimeInterval = 0
  var resumedAttempt = false
  var retryAttempts = 0
}
private enum TransferError: LocalizedError {
  case invalid(String)
  var errorDescription: String? { if case .invalid(let message) = self { return message }; return nil }
}

/** URLSession owns transfers while React is suspended. Persist state outside JS. */
final class PhoneGptTransfers: NSObject, URLSessionDownloadDelegate {
  static let shared = PhoneGptTransfers()
  let queue = DispatchQueue(label: "PhoneGPT.Transfers")
  let identifier = "\(Bundle.main.bundleIdentifier ?? "com.phonegpt.app").models.v1"
  private var jobs: [String: Transfer] = [:]
  private var tasks: [String: URLSessionDownloadTask] = [:]
  private var completion: (() -> Void)?
  private var initializationError: Error?
  private var reconnecting = false
  private var available = true
  private let monitor = NWPathMonitor()
  private var root: URL { FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("PhoneGPT", isDirectory: true) }
  private var stateFile: URL { root.appendingPathComponent("transfers.json") }
  private lazy var session: URLSession = {
    let config = URLSessionConfiguration.background(withIdentifier: identifier)
    config.isDiscretionary = false
    config.sessionSendsLaunchEvents = true
    config.waitsForConnectivity = true
    let delegates = OperationQueue()
    delegates.maxConcurrentOperationCount = 1
    delegates.underlyingQueue = queue
    return URLSession(configuration: config, delegate: self, delegateQueue: delegates)
  }()
  private override init() {
    super.init()
    do {
      var directory = root
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      var values = URLResourceValues(); values.isExcludedFromBackup = true
      try directory.setResourceValues(values)
      if FileManager.default.fileExists(atPath: stateFile.path) {
        jobs = try JSONDecoder().decode([String: Transfer].self, from: Data(contentsOf: stateFile))
        for (id, job) in jobs { try validate(id: id, fileName: job.fileName, source: job.source) }
      }
    } catch { initializationError = error }
    monitor.pathUpdateHandler = { [weak self] path in
      self?.queue.async { [weak self] in
        guard let self = self else { return }
        self.available = path.status == .satisfied
        if self.available {
          for (id, job) in self.jobs where job.status == "paused" && job.pauseReason != "manual" && self.tasks[id] == nil {
            self.begin(id)
          }
        }
      }
    }
    monitor.start(queue: DispatchQueue(label: "PhoneGPT.Network"))
  }
  func reconnect() {
    queue.async {
      guard !self.reconnecting else { return }
      self.reconnecting = true
      self.session.getAllTasks { restored in
        self.queue.async {
          defer { self.reconnecting = false }
          var found = Set<String>()
          for task in restored {
            guard let task = task as? URLSessionDownloadTask, let job = self.job(task) else { task.cancel(); continue }
            found.insert(job.id); self.tasks[job.id] = task
            if job.status == "paused", job.pauseReason == "manual" { task.cancel(); continue }
            if task.state == .suspended { task.resume() }
          }
          for (id, var job) in self.jobs where (["running", "pending"].contains(job.status) || (job.status == "paused" && job.pauseReason != "manual")) && !found.contains(id) && self.tasks[id] == nil {
            if FileManager.default.fileExists(atPath: self.destination(job).path) {
              job.status = "completed"; self.jobs[id] = job
            } else {
              // A process can die between staging a job and registering a task.
              self.begin(id)
            }
          }
          try? self.persist()
        }
      }
    }
  }
  func backgroundEvents(_ handler: @escaping () -> Void) {
    queue.async { self.completion = handler; _ = self.session }
  }
  private func validate(id: String, fileName: String, source: String) throws {
    let validID = !id.isEmpty && id.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil
    guard validID, !fileName.isEmpty, fileName != ".", fileName != "..", !fileName.contains("/"), !fileName.contains("\\"),
      let url = URL(string: source), url.scheme == "https", url.host != nil else { throw TransferError.invalid("Invalid model transfer") }
  }
  private func destination(_ job: Transfer) -> URL { root.appendingPathComponent("models", isDirectory: true).appendingPathComponent(job.fileName) }
  private func resumeFile(_ id: String) -> URL { root.appendingPathComponent("\(id).resume") }
  private func persist() throws { try JSONEncoder().encode(jobs).write(to: stateFile, options: .atomic) }
  private func job(_ task: URLSessionTask) -> Transfer? {
    guard let description = task.taskDescription else { return nil }
    return jobs.values.first { "\($0.id):\($0.token)" == description }
  }
  private func begin(_ id: String) {
    guard var job = jobs[id], let url = URL(string: job.source) else { return }
    let resumed = try? Data(contentsOf: resumeFile(id))
    let task = resumed.map { session.downloadTask(withResumeData: $0) } ?? session.downloadTask(with: url)
    job.resumedAttempt = resumed != nil
    job.token = UUID().uuidString
    task.taskDescription = "\(id):\(job.token)"
    tasks[id] = task; job.status = "pending"; job.pauseReason = nil; job.error = nil; jobs[id] = job
    do { try persist(); task.resume() }
    catch { task.cancel(); job.status = "failed"; job.error = error.localizedDescription; jobs[id] = job }
  }
  func state(_ id: String) -> [String: Any] {
    if let error = initializationError { return ["status": "failed", "progress": 0, "error": "Download metadata could not be opened: \(error.localizedDescription)"] }
    guard let job = jobs[id] else { return ["status": "none", "progress": 0] }
    var result: [String: Any] = ["status": job.status, "progress": job.expected > 0 ? min(1, max(0, Double(job.written) / Double(job.expected))) : 0, "canPause": true]
    if job.status == "completed" { result["progress"] = 1; result["uri"] = destination(job).absoluteString }
    if let error = job.error { result["error"] = error }
    if let reason = job.pauseReason { result["pauseReason"] = reason }
    if !available && ["pending", "running"].contains(job.status) { result["status"] = "paused"; result["pauseReason"] = "network"; result["error"] = "No internet" }
    return result
  }
  func enqueue(id: String, source: String, fileName: String) throws -> [String: Any] {
    if let error = initializationError { throw error }
    try validate(id: id, fileName: fileName, source: source)
    if let old = jobs[id], old.status != "failed" { return state(id) }
    // Do not let different model IDs collide on a destination filename.
    guard !jobs.values.contains(where: { $0.id != id && $0.fileName == fileName }) else { throw TransferError.invalid("A different model already uses this filename") }
    try FileManager.default.createDirectory(at: root.appendingPathComponent("models"), withIntermediateDirectories: true)
    if let previous = jobs[id], previous.source != source || previous.fileName != fileName { try? FileManager.default.removeItem(at: resumeFile(id)) }
    jobs[id] = Transfer(id: id, source: source, fileName: fileName)
    try persist(); begin(id); return state(id)
  }
  func pause(_ id: String, promise: Promise) {
    guard var job = jobs[id], ["pending", "running"].contains(job.status), let task = tasks[id] else { promise.resolve(state(id)); return }
    job.status = "paused"; job.pauseReason = "manual"; job.error = nil; jobs[id] = job
    do { try persist() } catch { promise.reject(error); return }
    task.cancel { data in
      self.queue.async {
        guard self.jobs[id]?.token == job.token, self.jobs[id]?.status == "paused" else { promise.resolve(self.state(id)); return }
        do {
          if let data = data { try data.write(to: self.resumeFile(id), options: .atomic) }
          else { try? FileManager.default.removeItem(at: self.resumeFile(id)) }
          self.tasks.removeValue(forKey: id); promise.resolve(self.state(id))
        } catch { promise.reject(error) }
      }
    }
  }
  func resume(_ id: String) throws -> [String: Any] {
    guard var job = jobs[id], job.status == "paused" else { return state(id) }
    jobs[id] = job; begin(id); return state(id)
  }
  func cancel(_ id: String) throws -> Bool {
    guard let job = jobs[id] else { return false }
    jobs.removeValue(forKey: id)
    do { try persist() } catch { jobs[id] = job; throw error }
    tasks.removeValue(forKey: id)?.cancel()
    try? FileManager.default.removeItem(at: resumeFile(id))
    if job.status != "completed" { try? FileManager.default.removeItem(at: destination(job)) }
    return true
  }
  func delete(_ id: String) throws -> Bool {
    let path = jobs[id].map(destination)
    if let path = path, FileManager.default.fileExists(atPath: path.path) { try FileManager.default.removeItem(at: path) }
    _ = try cancel(id)
    return true
  }
  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
    guard var job = job(downloadTask), job.status != "paused" else { return }
    job.status = "running"; job.written = totalBytesWritten; job.expected = totalBytesExpectedToWrite
    let now = Date().timeIntervalSince1970
    let save = now - job.lastSaved >= 1
    if save { job.lastSaved = now }
    jobs[job.id] = job
    if save { try? persist() }
  }
  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
    guard var job = job(downloadTask), job.status != "paused" else { return }
    do {
      guard let response = downloadTask.response as? HTTPURLResponse, (200...299).contains(response.statusCode) else { throw TransferError.invalid("Model host returned an unsuccessful HTTP response") }
      let size = (try FileManager.default.attributesOfItem(atPath: location.path)[.size] as? NSNumber)?.int64Value ?? 0
      guard size > 0, job.expected <= 0 || size == job.expected else { throw TransferError.invalid("The downloaded model is incomplete") }
      let target = destination(job)
      if FileManager.default.fileExists(atPath: target.path) { try FileManager.default.removeItem(at: target) }
      try FileManager.default.moveItem(at: location, to: target)
      job.status = "completed"; job.written = size; job.expected = size; job.pauseReason = nil; job.error = nil
      jobs[job.id] = job
      try persist(); try? FileManager.default.removeItem(at: resumeFile(job.id))
    } catch { job.status = "failed"; job.error = error.localizedDescription; jobs[job.id] = job; try? persist() }
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard var job = job(task) else { return }
    if tasks[job.id]?.taskIdentifier == task.taskIdentifier { tasks.removeValue(forKey: job.id) }
    guard job.status != "completed", job.status != "paused", let error = error as NSError? else { return }
    if let data = error.userInfo[NSURLSessionDownloadTaskResumeData] as? Data {
      try? data.write(to: resumeFile(job.id), options: .atomic)
    } else if job.resumedAttempt {
      // A rejected checkpoint must not poison every future Retry.
      try? FileManager.default.removeItem(at: resumeFile(job.id))
    }
    let transient = error.domain == NSURLErrorDomain && [NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost, NSURLErrorTimedOut, NSURLErrorCannotConnectToHost, NSURLErrorCannotFindHost].contains(error.code)
    if transient && job.retryAttempts < 6 {
      job.retryAttempts += 1; job.status = "paused"
      job.pauseReason = available ? "retry" : "network"
      job.error = available ? "Waiting to retry" : "No internet"
      jobs[job.id] = job; try? persist()
      let id = job.id, token = job.token
      queue.asyncAfter(deadline: .now() + min(60, pow(2, Double(job.retryAttempts)))) {
        guard self.available, let current = self.jobs[id], current.token == token,
          current.status == "paused", current.pauseReason != "manual", self.tasks[id] == nil else { return }
        self.begin(id)
      }
      return
    }
    job.status = "failed"; job.error = error.localizedDescription; jobs[job.id] = job; try? persist()
  }
  func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    let handler = completion; completion = nil
    if let handler = handler { DispatchQueue.main.async { handler() } }
  }
}

public final class PhoneGptDownloadsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhoneGptDownloads")
    OnCreate { PhoneGptTransfers.shared.reconnect() }
    AsyncFunction("getState") { (id: String) in PhoneGptTransfers.shared.state(id) }.runOnQueue(PhoneGptTransfers.shared.queue)
    AsyncFunction("enqueue") { (id: String, url: String, name: String) in try PhoneGptTransfers.shared.enqueue(id: id, source: url, fileName: name) }.runOnQueue(PhoneGptTransfers.shared.queue)
    AsyncFunction("pause") { (id: String, promise: Promise) in PhoneGptTransfers.shared.pause(id, promise: promise) }.runOnQueue(PhoneGptTransfers.shared.queue)
    AsyncFunction("resume") { (id: String) in try PhoneGptTransfers.shared.resume(id) }.runOnQueue(PhoneGptTransfers.shared.queue)
    AsyncFunction("cancel") { (id: String) in try PhoneGptTransfers.shared.cancel(id) }.runOnQueue(PhoneGptTransfers.shared.queue)
    AsyncFunction("delete") { (id: String) in try PhoneGptTransfers.shared.delete(id) }.runOnQueue(PhoneGptTransfers.shared.queue)
  }
}

public final class PhoneGptBackgroundSessionSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    PhoneGptTransfers.shared.reconnect(); return true
  }
  public func application(_ application: UIApplication, handleEventsForBackgroundURLSession identifier: String, completionHandler: @escaping () -> Void) {
    guard identifier == PhoneGptTransfers.shared.identifier else { return }
    PhoneGptTransfers.shared.backgroundEvents(completionHandler)
  }
}
