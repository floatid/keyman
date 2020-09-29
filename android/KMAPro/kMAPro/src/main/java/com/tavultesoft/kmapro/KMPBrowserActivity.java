/**
 * Copyright (C) 2020 SIL International. All rights reserved.
 */

package com.tavultesoft.kmapro;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Point;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.RelativeLayout;

import androidx.appcompat.app.AppCompatActivity;

import com.tavultesoft.kmea.KMManager;
import com.tavultesoft.kmea.KMKeyboard;
import com.tavultesoft.kmea.KeyboardEventHandler;
import com.tavultesoft.kmea.util.KMPLink;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class KMPBrowserActivity extends AppCompatActivity implements KeyboardEventHandler.OnKeyboardEventListener {
  private static final String TAG = "KMPBrowserActivity";

  // URL for keyboard search web page presented to user when they add a keyboard in the app.
  private static final String KMP_SEARCH_KEYBOARDS_FORMATSTR = "https://%s/go/android/%s/download-keyboards%s";
  private static final String KMP_SEARCH_KEYBOARDS_LANGUAGES = "/languages/%s";

  // Patterns for determining if a link should be opened in external browser
  // 1. Host isn't keyman.com (production/staging)
  // 2. Host is keyman.com but not /keyboards/
  private static final String INTERNAL_KEYBOARDS_LINK_FORMATSTR = "^http(s)?://(%s|%s)/keyboards([/?].*)?$";
  private static final String keyboardPatternFormatStr = String.format(INTERNAL_KEYBOARDS_LINK_FORMATSTR,
    KMPLink.KMP_PRODUCTION_HOST,
    KMPLink.KMP_STAGING_HOST);
  private static final Pattern keyboardPattern = Pattern.compile(keyboardPatternFormatStr);

  private static View inputView = null;
  private static RelativeLayout keyboardLayout;

  private WebView webView;
  private boolean isLoading = false;
  private boolean didFinishLoading = false;

  @SuppressLint({"SetJavaScriptEnabled", "InflateParams"})
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    final Context context = this;

    KMManager.initialize(this, KMManager.KeyboardType.KEYBOARD_TYPE_INAPP);

    setContentView(R.layout.activity_kmp_browser);

    webView = (WebView) findViewById(R.id.kmpBrowserWebView);
    webView.getSettings().setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);
    webView.getSettings().setJavaScriptEnabled(true);
    webView.getSettings().setUseWideViewPort(true);
    webView.getSettings().setLoadWithOverviewMode(true);
    webView.getSettings().setBuiltInZoomControls(true);
    webView.getSettings().setSupportZoom(true);
    webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);

    webView.setWebChromeClient(new WebChromeClient() {
      public void onProgressChanged(WebView view, int progress) {
      }
    });
    webView.setWebViewClient(new WebViewClient() {
      @Override
      public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
        didFinishLoading = true;
        isLoading = false;
      }

      @Override
      public boolean shouldOverrideUrlLoading(WebView view, String url) {
        String lowerURL = url.toLowerCase();
        if (lowerURL.equals("about:blank")) {
          return true; // never load a blank page, e.g. when the component initializes
        }

        if (KMPLink.isKeymanInstallLink(url)) {
          Uri downloadURI = KMPLink.getKeyboardDownloadLink(url);

          // Create intent with keyboard download link for KMAPro main activity to handle
          Intent intent = new Intent(context, MainActivity.class);
          intent.setData(downloadURI);
          startActivity(intent);

          // Finish activity
          finish();
        } else if (!isKeymanKeyboardsLink(url)) {
          Uri uri = Uri.parse(url);

          // All links that aren't internal Keyman keyboard links open in user's browser
          Intent intent = new Intent(Intent.ACTION_VIEW, uri);
          startActivity(intent);
          return true;
        }
        if (lowerURL.startsWith("keyman:")) {
          // Warn for unsupported keyman schemes
          Log.d(TAG, "Scheme for " + url + " not handled");
          return true;
        }

        // Display URL
        return false;
      }

      @Override
      public void onPageStarted(WebView view, String url, Bitmap favicon) {
        isLoading = true;
        didFinishLoading = false;
      }

      @Override
      public void onPageFinished(WebView view, String url) {
        didFinishLoading = true;
        isLoading = false;
      }
    });

    // Tier determines the keyboard search host
    String host = KMPLink.getHost();
    // If language ID is provided, include it in the keyboard search
    String languageID = getIntent().getStringExtra("languageCode");
    String languageStr = (languageID != null) ? String.format(KMP_SEARCH_KEYBOARDS_LANGUAGES, languageID) : "";
    String appMajorVersion = KMManager.getMajorVersion();
    String kmpSearchUrl = String.format(KMP_SEARCH_KEYBOARDS_FORMATSTR, host, appMajorVersion, languageStr);
    webView.loadUrl(kmpSearchUrl);
  }

  private void resizeWebView(boolean isKeyboardVisible) {
    int bannerHeight = 0;
    int keyboardHeight = 0;
    if (isKeyboardVisible) {
      bannerHeight = KMManager.getBannerHeight(this);
      keyboardHeight = KMManager.getKeyboardHeight(this);
    }

    // *** TO DO: Try to check if status bar is visible, set statusBarHeight to 0 if it is not visible ***
    int statusBarHeight = 0;
    int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
    if (resourceId > 0)
      statusBarHeight = getResources().getDimensionPixelSize(resourceId);

    Point size = new Point(0, 0);
    getWindowManager().getDefaultDisplay().getSize(size);
    int screenHeight = size.y;
    int screenWidth = size.x;
    Log.d(TAG, "KMPBrowserActivity resizeWebView bannerHeight: " + bannerHeight);

    //RelativeLayout layout = new RelativeLayout(this);
    RelativeLayout.LayoutParams params = new RelativeLayout.LayoutParams(screenWidth,
      screenHeight - statusBarHeight - bannerHeight - keyboardHeight);
    webView.setLayoutParams(params);
    //layout.addView(webView, params);

    if (keyboardLayout == null) {
      keyboardLayout = new RelativeLayout(getApplicationContext());
      keyboardLayout.setLayoutParams(new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
      keyboardLayout.setBackgroundColor(Color.TRANSPARENT);
      keyboardLayout.setVisibility(View.GONE);
      keyboardLayout.setEnabled(false);
    }

    KMKeyboard inAppKeyboard = KMManager.getInAppKeyboard();
    if (inAppKeyboard != null && inAppKeyboard.getParent() == null) {
      keyboardLayout.addView(inAppKeyboard);
    }
  }

  /*
  @Override
  public View onCreateInputView() {
    if (inputView == null) {
      inputView = KMManager.createInputView(this);
    }

    ViewGroup parent = (ViewGroup) inputView.getParent();
    if (parent != null)
      parent.removeView(inputView);

    return inputView;
  }
*/

  @Override
  protected void onResume() {
    super.onResume();
    KMManager.onResume();
    KMManager.addKeyboardEventListener(this);
    KMManager.hideSystemKeyboard();

    if (webView != null) {
      webView.reload();
    }
    resizeWebView(true);
  }

  @Override
  protected void onPause() {
    super.onPause();
    KMManager.onPause();
    KMManager.removeKeyboardEventListener(this);
  }

  @Override
  protected void onDestroy() {
    super.onDestroy();
  }

  @Override
  public void onKeyboardLoaded(KMManager.KeyboardType keyboardType) {
    int kbIndex = 0;
    KMManager.setKeyboard(this, kbIndex);
  }

  @Override
  public void onKeyboardChanged(String newKeyboard) {
    // do nothing
  }

  @Override
  public void onKeyboardShown() {
    resizeWebView(true);
  }

  @Override
  public void onKeyboardDismissed() {
    resizeWebView(false);
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);

    if (webView != null) {
      if (resultCode == RESULT_OK && data != null) {
        String url = data.getStringExtra("url");
        if (url != null)
          webView.loadUrl(url);
      }
    }
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
  }

  @Override
  public void onBackPressed() {
    if (webView != null && webView.canGoBack()) {
      webView.goBack();
    } else {
      super.onBackPressed();
      finish();
    }
  }

  /**
   * Check if a URL is a valid internal Keyman keyboard link
   * @param url String of the URL to parse
   * @return boolean
   */
  public boolean isKeymanKeyboardsLink(String url) {
    boolean status = false;
    if (url == null || url.isEmpty()) {
      return status;
    }
    Matcher matcher = keyboardPattern.matcher(url);
    if (matcher.matches()) {
      status = true;
    }

    return status;
  }
}
