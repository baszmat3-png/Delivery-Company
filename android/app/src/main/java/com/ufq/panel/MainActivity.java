package com.ufq.panel;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {
    private WebView web;
    private View splash;
    private final Handler h = new Handler(Looper.getMainLooper());
    private boolean ready = false;

    private int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density); }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        // شاشة انتظار باسم وشعار الشركة تظهر بدل شاشة Render عند استيقاظ الخادم
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(Color.WHITE);
        box.setClickable(true);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ic_launcher);
        box.addView(logo, new LinearLayout.LayoutParams(dp(180), dp(180)));
        ProgressBar pb = new ProgressBar(this);
        LinearLayout.LayoutParams pl = new LinearLayout.LayoutParams(dp(40), dp(40));
        pl.topMargin = dp(24);
        box.addView(pb, pl);
        TextView t = new TextView(this);
        t.setText("جارٍ الاتصال… الخدمة تستعد للعمل، ستفتح الصفحة تلقائيًا خلال لحظات");
        t.setTextColor(Color.parseColor("#164a8f"));
        t.setTextSize(16);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(32), dp(16), dp(32), 0);
        box.addView(t);
        splash = box;
        root.addView(box, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String sc = u.getScheme() == null ? "" : u.getScheme();
                if (!sc.equals("http") && !sc.equals("https")
                        || (u.getHost() != null && (u.getHost().contains("wa.me") || u.getHost().contains("whatsapp.com")))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                String title = v.getTitle() == null ? "" : v.getTitle();
                // صفحتنا عنوانها يحوي «التراث» أو «تتبع»؛ غير ذلك = صفحة Render أو خطأ
                if (title.contains("التراث") || title.contains("تتبع") || title.contains("بوابة")) {
                    ready = true;
                    splash.setVisibility(View.GONE);
                } else if (!ready) {
                    retry();
                }
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame() && !ready) retry();
            }
        });
        if (b != null) web.restoreState(b); else web.loadUrl(BuildConfig.APP_URL);
    }

    private void retry() {
        splash.setVisibility(View.VISIBLE);
        h.postDelayed(() -> { if (!ready) web.loadUrl(BuildConfig.APP_URL); }, 4000);
    }

    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
