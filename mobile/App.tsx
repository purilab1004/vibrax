import { useEffect, useRef, useState, useCallback } from 'react'
import { BackHandler, Platform, RefreshControl, ScrollView, StyleSheet, View, ActivityIndicator, Linking } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import * as WebBrowser from 'expo-web-browser'
import * as SplashScreen from 'expo-splash-screen'
import Constants from 'expo-constants'

SplashScreen.preventAutoHideAsync().catch(() => {})

const SITE = (Constants.expoConfig?.extra?.siteUrl as string) || 'https://vibrexcup.com'
// 앱 안에서 열 우리 도메인. 그 외(구글 로그인·외부 링크)는 시스템 브라우저로 연다.
const isInternal = (url: string) => {
  try { const u = new URL(url); return u.hostname.endsWith('vibrexcup.com') } catch { return false }
}

export default function App() {
  const webRef = useRef<WebView>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [loading, setLoading] = useState(true)

  // Android 하드웨어 뒤로가기 → 웹뷰 뒤로가기
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) { webRef.current?.goBack(); return true }
      return false
    })
    return () => sub.remove()
  }, [canGoBack])

  // 구글 OAuth·외부 링크는 시스템 브라우저(ASWebAuthenticationSession/Custom Tabs)로 — 웹뷰 내 OAuth 는 구글이 차단
  const onShouldStart = useCallback((req: WebViewNavigation) => {
    const url = req.url
    // 구글/OAuth 등 외부는 시스템 브라우저로 (웹뷰 내 OAuth 는 구글이 차단)
    if (url.startsWith('http') && !isInternal(url)) {
      WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url))
      return false
    }
    return true
  }, [])

  // 웹에서 온 OAuth 요청 처리 — 시스템 인증 세션으로 로그인 후 앱으로 복귀, 세션 코드를 웹뷰 콜백에 전달
  const onMessage = useCallback(async (e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type?: string; url?: string }
      if (msg.type === 'oauth' && msg.url) {
        const result = await WebBrowser.openAuthSessionAsync(msg.url, 'vibrexcup://auth')
        if (result.type === 'success' && result.url) {
          const ret = new URL(result.url)
          const code = ret.searchParams.get('code')
          const next = ret.searchParams.get('next') || '/'
          if (code) webRef.current?.injectJavaScript(`location.replace(${JSON.stringify(`${SITE}/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`)});true;`)
        }
      }
    } catch { /* ignore */ }
  }, [])

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.container}>
          <WebView
            ref={webRef}
            source={{ uri: SITE }}
            style={styles.web}
            onLoadEnd={() => { setLoading(false); SplashScreen.hideAsync().catch(() => {}) }}
            onNavigationStateChange={(s) => setCanGoBack(s.canGoBack)}
            onShouldStartLoadWithRequest={onShouldStart}
            onMessage={onMessage}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            domStorageEnabled
            javaScriptEnabled
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            originWhitelist={['https://*', 'vibrexcup://*']}
            setSupportMultipleWindows={false}
            mediaCapturePermissionGrantType="grant"
            userAgent={`VibrexcupApp/${Constants.expoConfig?.version} (${Platform.OS})`}
          />
          {loading && (
            <View style={styles.loader} pointerEvents="none">
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fcfaf5' },
  container: { flex: 1, backgroundColor: '#fcfaf5' },
  web: { flex: 1, backgroundColor: '#fcfaf5' },
  loader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fcfaf5' },
})
