package com.rayen.backend;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

@RestControllerAdvice
public class UploadExceptionHandler {
    // Handle container upload limits before a controller can read the file.
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    @ResponseStatus(HttpStatus.CONTENT_TOO_LARGE)
    public Map<String, String> tooLarge() {
        return Map.of("code", "FILE_TOO_LARGE", "message", "Upload exceeds the size limit. Choose a PDF of 5 MB or smaller.");
    }

    // Avoid logging malformed multipart requests or reflecting their contents.
    @ExceptionHandler({MultipartException.class, MissingServletRequestPartException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalidUpload() {
        return Map.of("code", "INVALID_UPLOAD", "message", "Select a PDF and upload it using the file field.");
    }
}
