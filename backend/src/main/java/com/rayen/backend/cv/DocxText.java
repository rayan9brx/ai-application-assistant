package com.rayen.backend.cv;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

/**
 * Extracts plain text from a .docx file with the JDK only: a .docx is a zip whose
 * word/document.xml holds the text in w:t elements, one w:p per paragraph.
 */
final class DocxText {
    private static final String WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    /** Guards against zip bombs: a CV's document.xml is far smaller than this. */
    private static final long MAX_XML_BYTES = 20L * 1024 * 1024;

    private DocxText() {}

    static boolean looksLikeZip(byte[] bytes) {
        return bytes.length > 4 && bytes[0] == 'P' && bytes[1] == 'K' && bytes[2] == 3 && bytes[3] == 4;
    }

    /** Returns the document text, or throws IOException when the file isn't a readable .docx. */
    static String extract(byte[] bytes, int maxChars) throws IOException {
        try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if ("word/document.xml".equals(entry.getName())) {
                    return readDocument(new LimitedInputStream(zip, MAX_XML_BYTES), maxChars);
                }
            }
        }
        throw new IOException("No word/document.xml");
    }

    private static String readDocument(InputStream xml, int maxChars) throws IOException {
        var factory = XMLInputFactory.newFactory();
        // Never resolve DTDs or external entities from an uploaded file (XXE).
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        var text = new StringBuilder();
        try {
            XMLStreamReader reader = factory.createXMLStreamReader(xml);
            boolean inText = false;
            while (reader.hasNext()) {
                int event = reader.next();
                if (event == XMLStreamReader.START_ELEMENT && WORD_NS.equals(reader.getNamespaceURI())) {
                    switch (reader.getLocalName()) {
                        case "t" -> inText = true;
                        case "tab" -> text.append('\t');
                        case "br", "cr" -> text.append('\n');
                        default -> { }
                    }
                } else if (event == XMLStreamReader.END_ELEMENT && WORD_NS.equals(reader.getNamespaceURI())) {
                    if ("t".equals(reader.getLocalName())) inText = false;
                    if ("p".equals(reader.getLocalName())) text.append('\n');
                } else if (event == XMLStreamReader.CHARACTERS && inText) {
                    text.append(reader.getText());
                }
                if (text.length() > maxChars) throw new TooLongException();
            }
        } catch (XMLStreamException exception) {
            throw new IOException("Invalid document.xml", exception);
        }
        return text.toString();
    }

    static class TooLongException extends RuntimeException {}

    /** Stops reading once more than `limit` bytes have been decompressed. */
    private static final class LimitedInputStream extends InputStream {
        private final InputStream in;
        private long remaining;

        LimitedInputStream(InputStream in, long limit) {
            this.in = in;
            this.remaining = limit;
        }

        @Override
        public int read() throws IOException {
            if (remaining-- <= 0) throw new IOException("document.xml too large");
            return in.read();
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            if (remaining <= 0) throw new IOException("document.xml too large");
            int read = in.read(buffer, offset, (int) Math.min(length, remaining));
            if (read > 0) remaining -= read;
            return read;
        }
    }
}
