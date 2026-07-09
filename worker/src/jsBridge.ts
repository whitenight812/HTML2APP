import fs from 'fs/promises';
import path from 'path';
import type { BuildConfig } from '../../shared/types';

export async function injectJSBridge(
  buildDir: string,
  config: BuildConfig
): Promise<void> {
  // Find MainActivity.java
  const mainActivityPath = path.join(
    buildDir, 'android', 'app', 'src', 'main', 'java',
    'com', 'html2app', sanitizeDir(config.appName || 'app'),
    'MainActivity.java'
  );

  let activityContent: string;
  try {
    activityContent = await fs.readFile(mainActivityPath, 'utf-8');
  } catch {
    console.warn('MainActivity.java not found, skipping JS bridge injection');
    return;
  }

  // Add WebView settings and JS interface
  const bridgeCode = `
  // HTML2APP JS Bridge — auto-injected
  import android.webkit.JavascriptInterface;
  import android.webkit.WebSettings;

  // Add this inside the MainActivity class, after loadUrl:
  // configureWebView();

  private void configureWebView() {
    WebSettings settings = getBridge().getWebView().getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    ${config.offlineCache ? `
    settings.setAppCacheEnabled(true);
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    ` : ''}
    ${(config.theme?.pullToRefresh) ? `
    // Pull to refresh is handled by Capacitor's SwipeRefreshLayout
    ` : ''}

    // Register JS Bridge
    getBridge().getWebView().addJavascriptInterface(
      new HTML2APPBridge(this), "HTML2APP"
    );
  }

  public class HTML2APPBridge {
    private final MainActivity activity;

    HTML2APPBridge(MainActivity activity) {
      this.activity = activity;
    }

    @JavascriptInterface
    public void showToast(String message) {
      activity.runOnUiThread(() ->
        android.widget.Toast.makeText(activity, message,
          android.widget.Toast.LENGTH_SHORT).show()
      );
    }

    @JavascriptInterface
    public String getAppVersion() {
      return android.os.BuildConfig.VERSION_NAME;
    }

    @JavascriptInterface
    public void exitApp() {
      activity.finish();
    }
  }
  `;

  // Inject the bridge before the closing brace of the class
  activityContent = activityContent.replace(
    /}\s*$/,
    bridgeCode + '\n}'
  );

  await fs.writeFile(mainActivityPath, activityContent);
}

function sanitizeDir(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'wrapper';
}
