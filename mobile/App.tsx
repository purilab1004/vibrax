import { useEffect, useRef, useState, useCallback } from 'react'
import { Animated, BackHandler, Easing, Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, Linking } from 'react-native'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import * as WebBrowser from 'expo-web-browser'
import * as SplashScreen from 'expo-splash-screen'
import Constants from 'expo-constants'

SplashScreen.preventAutoHideAsync().catch(() => {})

const SITE = (Constants.expoConfig?.extra?.siteUrl as string) || 'https://vibrexcup.com'
const BLUE = '#2563eb'
const GRAY = '#8a8172'

// 앱 안에서 열 우리 도메인. 그 외(구글 로그인·외부 링크)는 시스템 브라우저로 연다.
const EMBED_HOSTS = ['youtube.com', 'youtube-nocookie.com', 'googlevideo.com', 'ytimg.com', 'twitch.tv', 'jtvnw.net']
const isEmbedHost = (url: string) => {
  try { const host = new URL(url).hostname; return EMBED_HOSTS.some((h) => host === h || host.endsWith('.' + h)) } catch { return false }
}
const isInternal = (url: string) => {
  try { const u = new URL(url); return u.hostname.endsWith('vibrexcup.com') } catch { return false }
}

// 콘텐츠 로드 전에 주입 — (1) 웹 하단 내비 숨김(RN 탭바가 대신) (2) html 에 vbx-app 클래스 추가:
// 앱에서는 스크롤 성능을 위해 카드 상시 애니메이션을 끈다(웹은 그대로 화려하게 유지, globals.css 의 .vbx-app 규칙).
const APP_TWEAKS = `(function(){try{var d=document.documentElement;d.classList.add('vbx-app');var s=document.createElement('style');s.setAttribute('data-vbx','1');s.innerHTML="nav[aria-label='mobile navigation']{display:none !important}";(document.head||d).appendChild(s);}catch(e){}})();true;`

type TabDef = { key: string; label: string; icon?: number; center?: boolean }
const TABS: TabDef[] = [
  { key: '/', label: 'Home', icon: require('./assets/nav-home.png') },
  { key: '/games', label: 'Games', icon: require('./assets/nav-games.png') },
  { key: '/studio', label: 'Create', center: true },
  { key: '/tournament', label: 'Event', icon: require('./assets/nav-trophy.png') },
  { key: '/profile', label: 'My', icon: require('./assets/nav-profile.png') },
]

// 현재 경로 → 활성 탭 키
function matchTab(path: string): string | null {
  if (path === '/') return '/'
  for (const k of ['/games', '/studio', '/tournament', '/profile']) {
    if (path === k || path.startsWith(k + '/')) return k
  }
  return null
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  )
}

function Shell() {
  const insets = useSafeAreaInsets()
  const webRef = useRef<WebView>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [active, setActive] = useState<string | null>('/')
  const [tabBarHidden, setTabBarHidden] = useState(false)
  const [playing, setPlaying] = useState(false) // 게임 플레이 중 — 탭바·상태바 숨기고 전체 화면
  const [darkTop, setDarkTop] = useState(false) // 어두운 페이지(/games 피드·토너먼트)에선 상태바 글자를 흰색으로
  const [booting, setBooting] = useState(true)
  const [splashGone, setSplashGone] = useState(false)
  const [navLoading, setNavLoading] = useState(false)
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopNavLoading = useCallback(() => {
    if (navTimer.current) { clearTimeout(navTimer.current); navTimer.current = null }
    setNavLoading(false)
  }, [])

  // Android 하드웨어 뒤로가기 → 웹뷰 뒤로가기
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) { webRef.current?.goBack(); return true }
      return false
    })
    return () => sub.remove()
  }, [canGoBack])

  // 탭 터치 → 새로고침 없이 클라이언트 라우팅(브리지 없으면 전체 로드로 폴백)
  const go = useCallback((path: string) => {
    setActive(matchTab(path))
    // 로딩 중 마스코트 오버레이 — 새 페이지가 뜨면(route 메시지) 즉시 사라진다. 안전장치 4초.
    setNavLoading(true)
    if (navTimer.current) clearTimeout(navTimer.current)
    navTimer.current = setTimeout(() => setNavLoading(false), 4000)
    const js = `(function(){var p=${JSON.stringify(path)};if(window.__vibexNav){window.__vibexNav(p);}else{location.href=${JSON.stringify(SITE)}+p;}})();true;`
    webRef.current?.injectJavaScript(js)
  }, [])

  // 구글 OAuth·외부 링크는 시스템 브라우저로 (웹뷰 내 OAuth 는 구글이 차단)
  const onShouldStart = useCallback((req: WebViewNavigation) => {
    const url = req.url
    // iframe(YouTube/Twitch 임베드 등) 안의 로드는 그대로 허용 — 최상위 페이지 이동만 외부 브라우저로
    if (req.isTopFrame === false) return true
    // 안드로이드는 isTopFrame 이 없을 수 있어 임베드 플레이어 호스트는 항상 허용
    if (isEmbedHost(url)) return true
    if (url.startsWith('http') && !isInternal(url)) {
      WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url))
      return false
    }
    return true
  }, [])

  // 웹 → 네이티브 메시지: 라우트 동기화(탭 활성/숨김) + OAuth
  const onMessage = useCallback(async (e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type?: string; url?: string; path?: string; hideTabBar?: boolean; on?: boolean }
      if (msg.type === 'play') { setPlaying(!!msg.on); return }
      if (msg.type === 'route') {
        if (typeof msg.path === 'string') { setActive(matchTab(msg.path)); setDarkTop(/^\/(games(\/|$)|tournament)/.test(msg.path)) }
        setTabBarHidden(!!msg.hideTabBar)
        stopNavLoading() // 새 페이지 도착 → 로딩 마스코트 종료
        return
      }
      if (msg.type === 'oauth' && msg.url) {
        const result = await WebBrowser.openAuthSessionAsync(msg.url, 'vibrexcup://auth')
        if (result.type === 'success' && result.url) {
          const ret = new URL(result.url)
          const code = ret.searchParams.get('code')
          const next = ret.searchParams.get('next') || '/'
          if (code) webRef.current?.injectJavaScript(`location.replace(${JSON.stringify(`${SITE}/auth/callback?code=`)}+${JSON.stringify(encodeURIComponent(code))}+${JSON.stringify(`&next=${encodeURIComponent(next)}`)});true;`)
        }
      }
    } catch { /* ignore */ }
  }, [])

  const onLoadEnd = useCallback(() => {
    setBooting(false)
    stopNavLoading() // 전체 로드 완료 시에도 로딩 마스코트 종료
    SplashScreen.hideAsync().catch(() => {})
  }, [stopNavLoading])

  return (
    <View style={[styles.root, playing && styles.safePlaying]}>
      {/* 웹뷰가 상태바(카메라) 뒤까지 차지 — 흰 띠 없이 페이지가 위까지 채우고, 웹이 safe-area 만큼 상단 UI 를 내린다(window.VIBREX_INSETS) */}
      <StatusBar style={playing || darkTop ? 'light' : 'dark'} hidden={playing} translucent backgroundColor="transparent" />
      <SafeAreaView style={[styles.safe, playing && styles.safePlaying]} edges={[]}>
        <WebView
          ref={webRef}
          source={{ uri: SITE }}
          style={styles.web}
          onLoadEnd={onLoadEnd}
          onNavigationStateChange={(s) => setCanGoBack(s.canGoBack)}
          onShouldStartLoadWithRequest={onShouldStart}
          onMessage={onMessage}
          injectedJavaScriptBeforeContentLoaded={`${APP_TWEAKS}window.VIBREX_INSETS=${JSON.stringify({ top: insets.top, bottom: insets.bottom })};true;`}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          domStorageEnabled
          javaScriptEnabled
          allowsBackForwardNavigationGestures
          originWhitelist={['https://*', 'vibrexcup://*']}
          setSupportMultipleWindows={false}
          mediaCapturePermissionGrantType="grant"
          overScrollMode="never"
          androidLayerType="hardware"
          nestedScrollEnabled
          decelerationRate="fast"
          userAgent={`VibrexcupApp/${Constants.expoConfig?.version} (${Platform.OS})`}
        />
      </SafeAreaView>

      {!tabBarHidden && !playing && <TabBar active={active} onPress={go} bottomInset={insets.bottom} />}

      {splashGone && navLoading && <MiniMascotLoader />}

      {!splashGone && <AnimatedSplash ready={!booting} onDone={() => setSplashGone(true)} />}
    </View>
  )
}

// ─── 시작 스플래시 — 흰 배경, 마스코트가 중앙을 크게 차지하며 한 번 윙크 후 사라짐 ──
function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { width } = useWindowDimensions()
  const size = Math.round(width * 0.62)
  const scale = useRef(new Animated.Value(0.82)).current
  const wink = useRef(new Animated.Value(0)).current
  const fade = useRef(new Animated.Value(1)).current
  const [introDone, setIntroDone] = useState(false)

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {})
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 8 }),
      Animated.delay(140),
      Animated.timing(wink, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.delay(150),
      Animated.timing(wink, { toValue: 0, duration: 130, useNativeDriver: true }),
    ]).start(() => setIntroDone(true))
  }, [scale, wink])

  useEffect(() => {
    if (introDone && ready) {
      Animated.timing(fade, { toValue: 0, duration: 340, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onDone())
    }
  }, [introDone, ready, fade, onDone])

  return (
    <Animated.View style={[styles.splash, { opacity: fade }]} pointerEvents="none">
      <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
        <Image source={require('./assets/mascot-open.png')} style={{ width: size, height: size }} resizeMode="contain" />
        <Animated.Image source={require('./assets/mascot-wink.png')} style={{ width: size, height: size, position: 'absolute', top: 0, left: 0, opacity: wink }} resizeMode="contain" />
      </Animated.View>
    </Animated.View>
  )
}

// ─── 하단 탭바 ─────────────────────────────────────────────
function TabBar({ active, onPress, bottomInset }: { active: string | null; onPress: (p: string) => void; bottomInset: number }) {
  const pad = Math.max(bottomInset, 8)
  return (
    <View style={[styles.tabbar, { height: 56 + pad, paddingBottom: pad }]}>
      {TABS.map((t) => t.center
        ? <CenterButton key={t.key} label={t.label} onPress={() => onPress(t.key)} />
        : <TabItem key={t.key} tab={t} active={active === t.key} onPress={() => onPress(t.key)} />
      )}
    </View>
  )
}

function TabItem({ tab, active, onPress }: { tab: TabDef; active: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current
  const press = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start()
  return (
    <Pressable style={styles.tabItem} onPressIn={() => press(0.88)} onPressOut={() => press(1)} onPress={onPress} hitSlop={6}>
      <Animated.Image source={tab.icon} style={[styles.tabIcon, { tintColor: active ? BLUE : GRAY, transform: [{ scale }] }]} resizeMode="contain" />
      <Text numberOfLines={1} style={[styles.tabLabel, { color: active ? BLUE : GRAY }]}>{tab.label}</Text>
    </Pressable>
  )
}

// 중앙 "만들기" — 점토 마스코트가 몇 초마다 윙크
function CenterButton({ label, onPress }: { label: string; onPress: () => void }) {
  const wink = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  useEffect(() => {
    let alive = true
    const loop = () => {
      if (!alive) return
      Animated.sequence([
        Animated.delay(3800),
        Animated.timing(wink, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.delay(160),
        Animated.timing(wink, { toValue: 0, duration: 130, useNativeDriver: true }),
      ]).start(() => loop())
    }
    loop()
    return () => { alive = false }
  }, [wink])
  const press = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 8 }).start()
  return (
    <Pressable style={styles.tabItem} onPressIn={() => press(0.9)} onPressOut={() => press(1)} onPress={onPress} hitSlop={6}>
      <Animated.View style={[styles.centerWrap, { transform: [{ scale }] }]}>
        <Image source={require('./assets/mascot-open.png')} style={styles.centerImg} resizeMode="contain" />
        <Animated.Image source={require('./assets/mascot-wink.png')} style={[styles.centerImg, StyleSheet.absoluteFillObject, { opacity: wink }]} resizeMode="contain" />
      </Animated.View>
      <Text numberOfLines={1} style={[styles.tabLabel, { color: '#F05A28', marginTop: 1 }]}>{label}</Text>
    </Pressable>
  )
}

// ─── 내비 이동 중 로딩 — 로고 마스코트가 중앙에서 윙크 (스플래시보다 작게) ──
function MiniMascotLoader() {
  const wink = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.9)).current
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start()
    let alive = true
    const loop = () => {
      if (!alive) return
      Animated.sequence([
        Animated.timing(wink, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.delay(140),
        Animated.timing(wink, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.delay(520),
      ]).start(() => loop())
    }
    loop()
    return () => { alive = false }
  }, [wink, scale])
  return (
    <View style={styles.navLoader}>
      <Animated.View style={{ width: 92, height: 92, transform: [{ scale }] }}>
        <Image source={require('./assets/mascot-open.png')} style={{ width: 92, height: 92 }} resizeMode="contain" />
        <Animated.Image source={require('./assets/mascot-wink.png')} style={{ width: 92, height: 92, position: 'absolute', top: 0, left: 0, opacity: wink }} resizeMode="contain" />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fcfaf5' },
  safe: { flex: 1, backgroundColor: '#fcfaf5' },
  safePlaying: { backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#fcfaf5' },
  tabbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ebe4d6',
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  tabIcon: { width: 24, height: 24 },
  tabLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  centerWrap: { width: 30, height: 30 },
  centerImg: { width: 30, height: 30 },
  splash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  navLoader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(252,250,245,0.72)' },
})
