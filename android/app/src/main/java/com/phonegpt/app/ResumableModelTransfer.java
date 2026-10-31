package com.phonegpt.app;

import java.io.*;
import java.net.*;
import java.util.regex.*;

/** Streaming HTTP transfer; partial bytes are retained, never treated as installed. */
public final class ResumableModelTransfer {
  public interface Control {
    boolean stopped();
    void progress(long bytes, long total, String validator) throws IOException;
  }
  public static final class Stopped extends IOException {}
  public static final class ProtocolFailure extends IOException { ProtocolFailure(String message) { super(message); } }
  public static final class HttpFailure extends IOException {
    public final int status;
    HttpFailure(int status) { super("Model host returned HTTP " + status); this.status = status; }
  }
  public static void download(String url, File partial, String validator, Control control) throws IOException {
    long offset = partial.isFile() ? partial.length() : 0;
    // Without a validator, restarting is safer than mixing different file revisions.
    if (offset > 0 && (validator == null || validator.isEmpty())) offset = 0;
    HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
    connection.setConnectTimeout(15000);
    connection.setReadTimeout(5000);
    connection.setRequestProperty("Accept-Encoding", "identity");
    if (offset > 0) {
      connection.setRequestProperty("Range", "bytes=" + offset + "-");
      connection.setRequestProperty("If-Range", validator);
    }
    try {
      if (control.stopped()) throw new Stopped();
      int status = connection.getResponseCode();
      // A file already fully captured before process death can be confirmed by
      // a range response only when its validator also still matches.
      if (status == 416 && offset > 0) {
        String range = connection.getHeaderField("Content-Range");
        String current = responseValidator(connection);
        if (("bytes */" + offset).equals(range) && validator.equals(current)) {
          control.progress(offset, offset, validator); return;
        }
        throw new HttpFailure(status);
      }
      if (status != 200 && status != 206) throw new HttpFailure(status);
      long total;
      long expectedBody = connection.getContentLengthLong();
      if (status == 206) {
        Matcher match = Pattern.compile("bytes (\\d+)-(\\d+)/(\\d+)").matcher(String.valueOf(connection.getHeaderField("Content-Range")));
        if (!match.matches() || Long.parseLong(match.group(1)) != offset) throw new ProtocolFailure("Invalid resume response. Discard this download and try again.");
        long end = Long.parseLong(match.group(2));
        total = Long.parseLong(match.group(3));
        if (end < offset || end != total - 1 || (expectedBody >= 0 && expectedBody != end - offset + 1)) throw new ProtocolFailure("Invalid resume range. Discard this download and try again.");
      } else {
        // Host ignored Range, or If-Range detected a changed file: replace bytes.
        offset = 0;
        total = expectedBody;
      }
      String currentValidator = responseValidator(connection);
      if (status == 206 && offset > 0 && currentValidator != null && !currentValidator.equals(validator)) throw new ProtocolFailure("Model file changed. Discard this download and try again.");
      String savedValidator = currentValidator != null ? currentValidator : (status == 206 ? validator : null);
      try (InputStream input = connection.getInputStream(); RandomAccessFile output = new RandomAccessFile(partial, "rw")) {
        if (offset == 0) output.setLength(0);
        output.seek(offset);
        long bytes = offset, lastUpdate = 0;
        control.progress(bytes, total, savedValidator);
        byte[] buffer = new byte[65536];
        for (;;) {
          if (control.stopped()) throw new Stopped();
          int count = input.read(buffer);
          if (count == -1) break;
          if (control.stopped()) throw new Stopped();
          output.write(buffer, 0, count);
          bytes += count;
          if (total >= 0 && bytes > total) throw new IOException("Model host sent more bytes than expected");
          long now = System.nanoTime();
          if (now - lastUpdate >= 250000000L) { control.progress(bytes, total, savedValidator); lastUpdate = now; }
        }
        output.getFD().sync();
        if (control.stopped()) throw new Stopped();
        if (bytes == 0 || (total >= 0 && bytes != total)) throw new IOException("Connection interrupted before the model finished downloading");
        control.progress(bytes, bytes, savedValidator);
      }
    } finally { connection.disconnect(); }
  }
  private static String responseValidator(HttpURLConnection connection) {
    String etag = connection.getHeaderField("ETag");
    if (etag != null && !etag.startsWith("W/")) return etag;
    return connection.getHeaderField("Last-Modified");
  }
}
