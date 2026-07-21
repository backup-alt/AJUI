package com.annaibuilders.agb.supervisor;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#002263"));
        window.setNavigationBarColor(Color.parseColor("#002263"));
        View decorView = window.getDecorView();
        decorView.setBackgroundColor(Color.parseColor("#002263"));
    }
}
