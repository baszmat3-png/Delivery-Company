package com.ufq.panel;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
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
    private ValueCallback<Uri[]> filePathCb;
    private WebView printView;

    /** جسر الطباعة: يستدعيه الموقع بـ AndroidPrint.printHtml(html, widthMm) */
    public class PrintBridge {
        /** حفظ ملف (صورة / PDF) في مجلد التنزيلات: AndroidPrint.saveFile(base64, name, mime) */
        @JavascriptInterface
        public void saveFile(final String b64, final String name, final String mime) {
            String msg;
            try {
                byte[] data = Base64.decode(b64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                    cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    OutputStream os = getContentResolver().openOutputStream(u);
                    os.write(data);
                    os.close();
                    msg = "تم الحفظ في مجلد التنزيلات: " + name;
                } else {
                    File f = new File(getExternalFilesDir(null), name);
                    FileOutputStream os = new FileOutputStream(f);
                    os.write(data);
                    os.close();
                    msg = "تم الحفظ: " + f.getAbsolutePath();
                }
            } catch (Exception e) {
                msg = "تعذر حفظ الملف";
            }
            final String m = msg;
            runOnUiThread(() -> Toast.makeText(MainActivity.this, m, Toast.LENGTH_LONG).show());
        }

        @JavascriptInterface
        public void printHtml(final String html, final int widthMm) {
            runOnUiThread(() -> {
                printView = new WebView(MainActivity.this);
                printView.setWebViewClient(new WebViewClient() {
                    @Override public void onPageFinished(WebView v, String url) {
                        PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                        PrintDocumentAdapter ad = v.createPrintDocumentAdapter("UFQ-Receipt");
                        int mils = Math.round(widthMm / 25.4f * 1000f);
                        PrintAttributes.Builder b = new PrintAttributes.Builder()
                                .setMediaSize(new PrintAttributes.MediaSize("receipt" + widthMm, "Receipt " + widthMm + "mm", mils, 11000))
                                .setMinMargins(PrintAttributes.Margins.NO_MARGINS);
                        pm.print("UFQ-Receipt", ad, b.build());
                    }
                });
                printView.loadDataWithBaseURL(BuildConfig.APP_URL, html, "text/html", "utf-8", null);
            });
        }
    }

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
        web.addJavascriptInterface(new PrintBridge(), "AndroidPrint");
        // اختيار الملفات (استيراد Excel) — لا يعمل داخل WebView بدون هذا
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (filePathCb != null) filePathCb.onReceiveValue(null);
                filePathCb = cb;
                try {
                    startActivityForResult(p.createIntent(), 77);
                } catch (Exception e) { filePathCb = null; return false; }
                return true;
            }
        });
        // تنزيل الملفات (قالب Excel...) عبر المتصفح
        web.setDownloadListener((url, ua, cd, mime, len) -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) {}
        });
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

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == 77 && filePathCb != null) {
            filePathCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            filePathCb = null;
        } else super.onActivityResult(req, res, data);
    }

    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
