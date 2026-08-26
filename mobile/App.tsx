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
    if (url.startsWith('http') && !isInternal(url)) {
      WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url))
      return false
    }
    return true
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
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            domStorageEnabled
            javaScriptEnabled
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            originWhitelist={['https://*', 'vibrexcup://*']}
            setSupportMultipleWindows={false}
            // 카메라·마이크(방송) 권한 자동 허용 (앱 권한은 시스템이 별도 요청)
            onPermissionRequest={(e: any) => e?.grant?.(e?.resources)}
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
