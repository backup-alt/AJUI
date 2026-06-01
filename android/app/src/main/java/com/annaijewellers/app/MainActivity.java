package com.annaijewellers.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(
                "window.__annaiHandleNativeBack && window.__annaiHandleNativeBack();",
                null
            ));
            return;
        }

        super.onBackPressed();
    }
}
