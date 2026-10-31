package com.phonegpt.app;

import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

/** Local HTTP fixture: no model downloads or external requests. */
public class ResumableModelTransferTest {
  static byte[] data = new byte[1024 * 1024];
  static AtomicReference<String> lastRange = new AtomicReference<>();
  static class Control implements ResumableModelTransfer.Control {
    long bytes, total; String validator; boolean stop, pauseAfterData;
    public boolean stopped() { return stop; }
    public void progress(long bytes, long total, String validator) {
      this.bytes = bytes; this.total = total; this.validator = validator;
      if (pauseAfterData && bytes > 0) stop = true;
    }
  }
  static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
  static void same(File file) throws IOException { check(Arrays.equals(data, Files.readAllBytes(file.toPath())), "Bytes must match original exactly"); }
  static void failure(String url, File file, String validator) throws Exception {
    try { ResumableModelTransfer.download(url, file, validator, new Control()); throw new AssertionError("Expected failure"); }
    catch (IOException expected) {}
  }
  public static void main(String[] args) throws Exception {
    new Random(42).nextBytes(data);
    Path directory = Files.createTempDirectory("phonegpt-resume-tests");
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/", exchange -> {
      try {
        String path = exchange.getRequestURI().getPath();
        String range = exchange.getRequestHeaders().getFirst("Range");
        lastRange.set(range);
        String etag = path.equals("/changed") ? "\"v2\"" : "\"v1\"";
        if (!path.equals("/no-validator")) exchange.getResponseHeaders().set("ETag", etag);
        if (path.equals("/forbidden")) { exchange.sendResponseHeaders(403, -1); return; }
        if (path.equals("/complete")) {
          exchange.getResponseHeaders().set("Content-Range", "bytes */" + data.length);
          exchange.sendResponseHeaders(416, -1); return;
        }
        int offset = 0;
        boolean useRange = range != null && !path.equals("/ignore") && etag.equals(exchange.getRequestHeaders().getFirst("If-Range"));
        if (useRange) {
          offset = Integer.parseInt(range.substring(6, range.length() - 1));
          int from = path.equals("/bad-range") ? offset + 1 : offset;
          exchange.getResponseHeaders().set("Content-Range", "bytes " + from + "-" + (data.length - 1) + "/" + data.length);
        }
        int length = data.length - offset;
        exchange.sendResponseHeaders(useRange ? 206 : 200, path.equals("/short") ? length + 100 : length);
        exchange.getResponseBody().write(data, offset, length);
      } catch (IOException expectedWhenClientPauses) { }
      finally { exchange.close(); }
    });
    server.start();
    String base = "http://127.0.0.1:" + server.getAddress().getPort();
    try {
      File file = directory.resolve("model.part").toFile();
      Control paused = new Control(); paused.pauseAfterData = true;
      try { ResumableModelTransfer.download(base + "/normal", file, null, paused); throw new AssertionError("Expected stop"); }
      catch (ResumableModelTransfer.Stopped expected) {}
      check(file.length() > 0 && file.length() < data.length, "Pause must retain a partial file");
      long offset = file.length();
      Control resumed = new Control();
      ResumableModelTransfer.download(base + "/normal", file, paused.validator, resumed);
      check(("bytes=" + offset + "-").equals(lastRange.get()), "Resume must request remaining bytes"); same(file);
      System.out.println("PASS: pause retains prefix; resume requests remainder and matches original bytes");

      for (String path : new String[]{"/ignore", "/changed"}) {
        Files.write(file.toPath(), Arrays.copyOf(data, 10000));
        ResumableModelTransfer.download(base + path, file, "\"v1\"", new Control()); same(file);
      }
      System.out.println("PASS: ignored Range and changed validator restart safely without appending");

      Files.write(file.toPath(), Arrays.copyOf(data, 10000));
      ResumableModelTransfer.download(base + "/no-validator", file, null, new Control());
      check(lastRange.get() == null, "No unsafe resume without validator"); same(file);
      System.out.println("PASS: missing validator restarts safely");

      Files.write(file.toPath(), Arrays.copyOf(data, 10000));
      failure(base + "/bad-range", file, "\"v1\""); check(file.length() == 10000, "Invalid range cannot alter prefix");
      failure(base + "/forbidden", file, "\"v1\"");
      System.out.println("PASS: invalid range and HTTP failure rejected");

      Files.delete(file.toPath()); failure(base + "/short", file, null);
      System.out.println("PASS: truncated response is not completed");
      Files.write(file.toPath(), data);
      ResumableModelTransfer.download(base + "/complete", file, "\"v1\"", new Control()); same(file);
      System.out.println("PASS: fully captured checkpoint confirmed with matching 416 validator");
    } finally {
      server.stop(0);
      try (java.util.stream.Stream<Path> paths = Files.walk(directory)) {
        paths.sorted(Comparator.reverseOrder()).forEach(path -> { try { Files.delete(path); } catch (IOException error) { throw new UncheckedIOException(error); } });
      }
    }
  }
}
