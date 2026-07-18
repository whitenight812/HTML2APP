import fs from 'fs/promises';
import path from 'path';
import type { BuildConfig } from '../../shared/types';

async function findMainActivity(javaDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(javaDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(javaDir, entry.name);
      if (entry.isDirectory()) {
        const found = await findMainActivity(fullPath);
        if (found) return found;
      } else if (entry.name === 'MainActivity.java') {
        return fullPath;
      }
    }
  } catch {
    // Directory not accessible
  }
  return null;
}

export async function injectJSBridge(
  buildDir: string,
  config: BuildConfig
): Promise<void> {
  const javaDir = path.join(buildDir, 'android', 'app', 'src', 'main', 'java');
  const mainActivityPath = await findMainActivity(javaDir);

  if (!mainActivityPath) {
    console.warn('MainActivity.java not found, skipping JS bridge injection');
    return;
  }

  let content: string;
  try {
    content = await fs.readFile(mainActivityPath, 'utf-8');
  } catch {
    console.warn('MainActivity.java not readable, skipping JS bridge injection');
    return;
  }

  const pullToRefresh = Boolean(config.theme?.pullToRefresh);
  const forceMobileViewport = Boolean(config.theme?.forceMobileViewport);

  // 1. Add imports at the TOP of the file (after the package declaration)
  let importBlock = `
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.widget.Toast;
`;

  if (pullToRefresh) {
    importBlock += `import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import android.view.ViewGroup;
`;
  }

  if (forceMobileViewport) {
    importBlock += `import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.graphics.Bitmap;
`;
  }

  // Insert after "package ...;" line
  content = content.replace(
    /(package\s+[\w.]+;)/,
    '$1' + importBlock,
  );

  // 2. Build the pull-to-refresh setup snippet
  const swipeRefreshCode = pullToRefresh ? `
    try {
      android.view.View webView = getBridge().getWebView();
      android.view.ViewParent parent = webView.getParent();
      if (parent instanceof ViewGroup) {
        ViewGroup vg = (ViewGroup) parent;
        int index = vg.indexOfChild(webView);
        vg.removeView(webView);
        final SwipeRefreshLayout swipeLayout = new SwipeRefreshLayout(this);
        swipeLayout.addView(webView,
          new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT));
        vg.addView(swipeLayout, index);
        swipeLayout.setOnRefreshListener(
          new SwipeRefreshLayout.OnRefreshListener() {
            @Override
            public void onRefresh() {
              getBridge().getWebView().reload();
              swipeLayout.setRefreshing(false);
            }
          });
      }
    } catch (Exception e) {
      // Pull-to-refresh setup failed, continue without it
    }
` : '';

  // 3. Add class body code before the final closing brace.
  // Include onCreate() so configureWebView() and pull-to-refresh actually run.
  const hasOnCreate = content.includes('void onCreate(');

  const classCode = `
  ${hasOnCreate ? '' : `
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    configureWebView();
    ${swipeRefreshCode}
  }
  `}

  private void configureWebView() {
    WebSettings settings = getBridge().getWebView().getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(true);
    settings.setBuiltInZoomControls(true);
    settings.setDisplayZoomControls(false);
    ${config.offlineCache ? `
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    ` : ''}
    getBridge().getWebView().addJavascriptInterface(
      new HTML2APPBridge(this), "HTML2APP"
    );
    ${forceMobileViewport ? `
    final WebViewClient existingClient = getBridge().getWebView().getWebViewClient();
    getBridge().getWebView().setWebViewClient(new WebViewClient() {
      @Override
      public void onPageFinished(WebView view, String url) {
        if (existingClient != null) existingClient.onPageFinished(view, url);
        view.evaluateJavascript(
          "if(!document.querySelector('meta[name=viewport]')){" +
          "var m=document.createElement('meta');" +
          "m.name='viewport';" +
          "m.content='width=device-width,initial-scale=1.0';" +
          "document.head.appendChild(m);" +
          "}",
          null
        );
      }
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (existingClient != null) return existingClient.shouldOverrideUrlLoading(view, request);
        return false;
      }
      @Override
      public void onPageStarted(WebView view, String url, Bitmap favicon) {
        if (existingClient != null) existingClient.onPageStarted(view, url, favicon);
      }
      @Override
      public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (existingClient != null) existingClient.onReceivedError(view, request, error);
      }
    });
    ` : ''}
  }

  public class HTML2APPBridge {
    private final MainActivity activity;

    HTML2APPBridge(MainActivity activity) {
      this.activity = activity;
    }

    @JavascriptInterface
    public void showToast(String message) {
      activity.runOnUiThread(() ->
        Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
      );
    }

    @JavascriptInterface
    public String getAppVersion() {
      return "1.0";
    }

    @JavascriptInterface
    public void exitApp() {
      activity.finishAndRemoveTask();
    }
  }
`;

  content = content.replace(
    /}\s*$/,
    classCode + '\n}',
  );

  await fs.writeFile(mainActivityPath, content);
}
