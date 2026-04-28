package com.wingsfly.academy;

import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // After Capacitor bridge loads, configure WebView for camera/mic/speech
        getBridge().getWebView().post(() -> {
            WebView webView = getBridge().getWebView();

            // Enable JavaScript speech recognition & media access
            webView.getSettings().setJavaScriptEnabled(true);
            webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
            webView.getSettings().setDomStorageEnabled(true);

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    // Auto-grant camera + microphone to our own WebView
                    runOnUiThread(() -> request.grant(request.getResources()));
                }
            });
        });
    }
}
