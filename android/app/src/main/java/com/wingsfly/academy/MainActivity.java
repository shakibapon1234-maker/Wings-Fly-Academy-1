package com.wingsfly.academy;

import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize BridgeWebChromeClient synchronously in onCreate to avoid LifecycleOwner crash
        BridgeWebChromeClient chromeClient = new BridgeWebChromeClient(getBridge()) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Auto-grant camera + microphone to our own WebView
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        };

        // Configure WebView synchronously
        WebView webView = getBridge().getWebView();
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebChromeClient(chromeClient);
    }
}
