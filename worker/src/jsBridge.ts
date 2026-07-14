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

  // 1. Add imports at the TOP of the file (after the package declaration)
  const importBlock = `
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.widget.Toast;
`;

  // Insert after "package ...;" line
  content = content.replace(
    /(package\s+[\w.]+;)/,
    '$1' + importBlock,
  );

  // 2. Add class body code before the final closing brace
  const classCode = `
  private void configureWebView() {
    WebSettings settings = getBridge().getWebView().getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    ${config.offlineCache ? `
    settings.setAppCacheEnabled(true);
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    ` : ''}
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
