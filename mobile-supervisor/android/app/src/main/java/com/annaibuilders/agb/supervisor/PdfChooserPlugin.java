package com.annaibuilders.agb.supervisor;

import android.content.ClipData;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "PdfChooser")
public class PdfChooserPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isBlank()) {
            call.reject("A local PDF path is required.");
            return;
        }

        try {
            Uri uri = contentUriFor(path);
            Intent viewIntent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/pdf")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            viewIntent.setClipData(ClipData.newRawUri("PDF", uri));

            Intent chooser = Intent.createChooser(viewIntent, "Open PDF with");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            call.resolve(new JSObject());
        } catch (ActivityNotFoundException error) {
            call.reject("No PDF viewer is installed on this device.", "NO_PDF_VIEWER", error);
        } catch (Exception error) {
            call.reject("Could not open the PDF.", error);
        }
    }

    private Uri contentUriFor(String path) {
        Uri parsed = Uri.parse(path);
        if ("content".equalsIgnoreCase(parsed.getScheme())) {
            return parsed;
        }

        String filePath = "file".equalsIgnoreCase(parsed.getScheme())
            ? parsed.getPath()
            : path;
        if (filePath == null || filePath.isBlank()) {
            throw new IllegalArgumentException("Invalid PDF path.");
        }

        return FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            new File(filePath)
        );
    }
}
