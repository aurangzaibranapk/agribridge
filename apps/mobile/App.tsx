import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { normalizeChannel, showTesterReport } from "../../src/lib/mobile/channel";
import { dataFlavor, failureLine, sessionFromAccessToken, signInMobile, signUpMobile, type MobileSession } from "../../src/lib/mobile/live-login";
import { karachiDate, liveGetScoped, liveInsert, loadMyFarmerId, type MilkRow } from "../../src/lib/mobile/live-read";
import { brandLockup, loadAppMark, taglineWithDefault, type AppLang, type AppMark } from "../../src/lib/mobile/sub-brand";
import { BrandStack, LanguageProvider } from "./src/glass";
import { readTestAccount, showRolePreview, showRoleSwitch, SWITCH_ROLES, switchRoleLabel } from "../../src/lib/mobile/test-account";
import { refreshSupabaseSession, SESSION_EXPIRED, singleFlight, type RefreshFailure, type RefreshSuccess } from "../../src/lib/mobile/session-refresh";
import { ROLE_NAV } from "../../src/lib/mobile/nav";
import { canonicalAppRole, type AppRole } from "../../src/lib/mobile/roles";
import { pinLock, pinProblem } from "../../src/lib/mobile/pin";
import { applyFlushResult, enqueue, flushPlan, type OutboxItem } from "../../src/lib/mobile/queue";
import { reportContext } from "../../src/lib/mobile/report";
import { elapsed } from "../../src/lib/mobile/perf";
import { PHONE_VERSION_CODE, shownVersionCode } from "../../src/lib/mobile/shown-version";
import { mergeById, type NetState } from "../../src/lib/mobile/sync";
import { bootMark, marks } from "./src/boot";
import { loadRoleModule } from "./src/roles/load";
import { GlassPreview, glassPreviewOn } from "./src/roles/glass-preview";
import { Btn, Header, Tabs, colors } from "./src/kit";
import { AppLock, WebsiteLogin, WebsiteSignup, type SignUpForm } from "./src/auth-screens";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  productVersion?: string;
  versionCode?: number;
  appChannel?: string;
  appFlavor?: string;
  portalUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};
const VERSION = extra.productVersion || "";
const VERSION_CODE = shownVersionCode({
  platform: Platform.OS,
  embedded: extra.versionCode,
  phone: PHONE_VERSION_CODE,
});
const CHANNEL = normalizeChannel(extra.appChannel);
const FLAVOR = dataFlavor(extra.appFlavor);
const PORTAL = (extra.portalUrl || "").replace(/\/$/, "");
const SUPABASE_URL = extra.supabaseUrl || "";
const SUPABASE_ANON = extra.supabaseAnonKey || "";

async function sha(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

function uuid() {
  return Crypto.randomUUID();
}

function useLoginMark(): AppMark {
  const [mark, setMark] = useState<AppMark>({ brand: null, tagline: taglineWithDefault(null) });
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON) return;
    let gone = false;
    void loadAppMark({
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON,
      token: SUPABASE_ANON,
      channel: CHANNEL,
      flavor: FLAVOR,
    }, fetch).then((row) => {
      if (!gone) setMark(row);
    });
    return () => { gone = true; };
  }, []);
  return mark;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [stage, setStage] = useState<"login" | "pin" | "unlock" | "app">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [signup, setSignup] = useState<SignUpForm>({ fullName: "", email: "", phone: "", cnic: "", password: "" });
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("home");
  const [data, setData] = useState<any>(null);
  const [queue, setQueue] = useState<OutboxItem[]>([]);
  const [net, setNet] = useState<NetState>("unknown");
  const [screen, setScreen] = useState<any>(null);
  const [route, setRoute] = useState("/login");
  const [reportOpen, setReportOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [isTest, setIsTest] = useState(false);
  const [homeRole, setHomeRole] = useState<AppRole | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lang, setLang] = useState<AppLang>("rm");
  const loginMark = useLoginMark();
  const lock = brandLockup(lang, loginMark.tagline);
  useEffect(() => {
    void SecureStore.getItemAsync("agribridge.lang").then((value) => {
      if (value === "en" || value === "rm" || value === "ur") setLang(value);
    });
  }, []);
  function chooseLang(next: AppLang) {
    setLang(next);
    void SecureStore.setItemAsync("agribridge.lang", next);
  }
  const sessionRef = useRef<{ token: string; refresh: string; expiresAt: number | null } | null>(null);
  const refreshFlight = useRef<(() => Promise<RefreshSuccess | RefreshFailure>) | null>(null);

  function rememberSession(next: { token: string; refresh: string; expiresAt: number | null; role: string; appRole: AppRole; userId: string; isTest: boolean }) {
    sessionRef.current = { token: next.token, refresh: next.refresh, expiresAt: next.expiresAt };
    return SecureStore.setItemAsync("agribridge.session", JSON.stringify({
      token: next.token,
      refresh: next.refresh,
      expiresAt: next.expiresAt,
      role: next.role,
      appRole: next.appRole,
      userId: next.userId,
      isTest: next.isTest,
    }));
  }

  async function dropSession(message: string) {
    sessionRef.current = null;
    setToken(null);
    setStage("login");
    setRoute("/login");
    setError(message);
    await SecureStore.deleteItemAsync("agribridge.session");
  }

  async function runRefresh(): Promise<RefreshSuccess | RefreshFailure> {
    const current = sessionRef.current;
    if (!current?.refresh) return { ok: false, dead: true };
    const outcome = await refreshSupabaseSession({
      supabaseUrl: SUPABASE_URL,
      anonKey: SUPABASE_ANON,
      refreshToken: current.refresh,
      flavor: FLAVOR,
      fetchImpl: (url, init) => fetch(url, init),
    });
    if (!outcome.ok) {
      if (outcome.dead) await dropSession(SESSION_EXPIRED);
      return outcome;
    }
    sessionRef.current = { token: outcome.accessToken, refresh: outcome.refreshToken, expiresAt: outcome.expiresAt };
    setToken(outcome.accessToken);
    try {
      const raw = await SecureStore.getItemAsync("agribridge.session");
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        saved.token = outcome.accessToken;
        saved.refresh = outcome.refreshToken;
        saved.expiresAt = outcome.expiresAt;
        await SecureStore.setItemAsync("agribridge.session", JSON.stringify(saved));
      }
    } catch {
      // Naya token memory mein hai. Agli refresh dubara save karegi.
    }
    return outcome;
  }

  function refreshSession() {
    if (!refreshFlight.current) refreshFlight.current = singleFlight(runRefresh);
    return refreshFlight.current();
  }

  useEffect(() => {
    bootMark("first-screen");
    void (async () => {
      const saved = await SecureStore.getItemAsync("agribridge.session");
      const pinHash = await SecureStore.getItemAsync("agribridge.pin");
      if (saved && pinHash) {
        const session = JSON.parse(saved);
        sessionRef.current = {
          token: String(session.token ?? ""),
          refresh: String(session.refresh ?? ""),
          expiresAt: typeof session.expiresAt === "number" ? session.expiresAt : null,
        };
        setToken(session.token);
        setRole(session.role);
        const savedRole = canonicalAppRole(session.appRole);
        setAppRole(savedRole);
        setHomeRole(savedRole);
        setUserId(session.userId);
        setIsTest(session.isTest === true);
        setStage("unlock");
        setRoute("/unlock");
      }
      setReady(true);
      if (FLAVOR === "test" || !PORTAL) return;
      try {
        const res = await fetch(`${PORTAL}/api/mobile/v1/support`);
        const body = await res.json();
        setWhatsapp(body.whatsapp?.href ?? null);
        setNet(res.ok ? "online" : "unknown");
      } catch {
        setNet("offline");
      }
    })();
  }, []);

  useEffect(() => {
    if (!appRole || stage !== "app") return;
    let cancel = false;
    setScreen(null);
    void loadRoleModule(appRole).then((mod) => {
      if (!cancel) setScreen(() => mod.RoleScreen);
    });
    return () => { cancel = true; };
  }, [appRole, stage]);

  async function login() {
    setError("");
    setAuthBusy(true);
    const result = await signInMobile({
      identifier,
      password,
      portalUrl: PORTAL,
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON,
      channel: CHANNEL,
      flavor: FLAVOR,
      fetchImpl: (url, init) => fetch(url, init),
    });
    if (!result.ok) {
      setAuthBusy(false);
      if (result.offline) setNet("offline");
      setError(result.message);
      return;
    }
    await finishAuth(result.session);
    setAuthBusy(false);
  }

  async function finishAuth(body: MobileSession) {
    const test = await readTestAccount({
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON,
      token: body.access_token,
      channel: CHANNEL,
      flavor: FLAVOR,
    }, body.user_id, (url, init) => fetch(url, init));
    setToken(body.access_token);
    setRole(body.role);
    const resolvedRole = canonicalAppRole(body.appRole);
    setAppRole(resolvedRole);
    setHomeRole(resolvedRole);
    setUserId(body.user_id);
    setIsTest(test);
    await rememberSession({
      token: body.access_token,
      refresh: body.refresh_token,
      expiresAt: body.expires_at,
      role: body.role,
      appRole: resolvedRole,
      userId: body.user_id,
      isTest: test,
    });
    setPassword("");
    setNet("online");
    setStage("pin");
    setRoute("/pin");
  }

  async function createAccount() {
    setError("");
    setAuthBusy(true);
    const result = await signUpMobile({ ...signup, emailRedirectTo: FLAVOR === "test" ? "agribridge-test://auth/callback" : "agribridge://auth/callback", supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON, channel: CHANNEL, flavor: FLAVOR, fetchImpl: (url, init) => fetch(url, init) });
    setAuthBusy(false);
    if (!result.ok) { setError(result.message); return; }
    if (result.session) { await finishAuth(result.session); return; }
    setAuthMode("login");
    setIdentifier(signup.email);
    setPassword("");
    setError(result.message);
  }

  function oauth(provider: "google" | "facebook") {
    setError("");
    const redirect = FLAVOR === "test" ? "agribridge-test://auth/callback" : "agribridge://auth/callback";
    if (!SUPABASE_URL) { setError("Social login configuration nahi mili."); return; }
    const href = `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect)}`;
    void Linking.openURL(href).catch(() => setError(`${provider} login nahi khula.`));
  }

  useEffect(() => {
    async function accept(url: string) {
      if (!url.includes("auth/callback")) return;
      const raw = url.includes("#") ? url.split("#")[1] : url.split("?")[1] || "";
      const params = new URLSearchParams(raw);
      const accessToken = params.get("access_token") || "";
      if (!accessToken) { setError(params.get("error_description") || "Social login session nahi mili."); return; }
      setAuthBusy(true);
      const result = await sessionFromAccessToken({ accessToken, refreshToken: params.get("refresh_token") || "", expiresIn: Number(params.get("expires_in") || 0) || null, supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON, channel: CHANNEL, flavor: FLAVOR, fetchImpl: (next, init) => fetch(next, init) });
      setAuthBusy(false);
      if (!result.ok) { setError(result.message); return; }
      await finishAuth(result.session);
    }
    const sub = Linking.addEventListener("url", (event) => { void accept(event.url); });
    void Linking.getInitialURL().then((url) => { if (url) void accept(url); });
    return () => sub.remove();
  }, []);

  async function savePin() {
    const problem = pinProblem(pin);
    if (problem) { setError(problem); return; }
    const salt = uuid();
    const hash = await sha(`${salt}:${pin}`);
    await SecureStore.setItemAsync("agribridge.pin", JSON.stringify({ salt, hash }));
    setPin("");
    await openApp();
  }

  async function openApp() {
    const outcome = await refreshSession();
    if (!outcome.ok && outcome.dead) return;
    setStage("app");
    setRoute(`/${appRole}/home`);
    void sync(sessionRef.current?.token ?? token);
  }

  async function unlock(method: "pin" | "biometric") {
    const now = Date.now();
    if (lockedUntil && now < lockedUntil) { setError("PIN thori der band hai."); return; }
    if (method === "biometric") {
      const bio = await LocalAuthentication.authenticateAsync({ promptMessage: "AgriBridge kholen" });
      if (bio.success) { await openApp(); return; }
      setError("Fingerprint nahi hui.");
      return;
    }
    const raw = await SecureStore.getItemAsync("agribridge.pin");
    if (!raw) { setStage("pin"); return; }
    const stored = JSON.parse(raw) as { salt: string; hash: string };
    const hashed = await sha(`${stored.salt}:${pin}`);
    if (pinProblem(pin) || hashed !== stored.hash) {
      const next = pinLock(fails, now, lockedUntil);
      setFails(next.fails);
      setLockedUntil(next.lockedUntil);
      setError(next.locked ? "5 ghalat PIN. 15 minute band." : "PIN ghalat hai.");
      return;
    }
    setFails(0);
    setPin("");
    await openApp();
  }

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && sessionRef.current?.refresh) void refreshSession();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (stage !== "app" || !sessionRef.current?.refresh) return;
    const exp = sessionRef.current?.expiresAt;
    const wait = exp ? Math.max(15_000, exp * 1000 - Date.now() - 60_000) : 15 * 60 * 1000;
    const timer = setTimeout(() => { void refreshSession(); }, wait);
    return () => clearTimeout(timer);
  }, [stage, token]);

  async function sync(access = token) {
    if (!access) return;
    if (FLAVOR === "test") {
      const pickups = queue.filter((item) => item.kind === "pickup" && !item.error);
      if (!pickups.length) return;
      const auth = { url: SUPABASE_URL, anonKey: SUPABASE_ANON, token: access, userId, channel: CHANNEL, flavor: FLAVOR, testAccount: true, refreshSession };
      const results: { clientUuid: string; ok: boolean; error?: string; offline?: boolean }[] = [];
      for (const item of pickups) {
        const body = item.payload;
        const saved = await liveInsert<MilkRow>(auth, "milk_entries", {
          farmer_id: body.farmer_id,
          entry_date: typeof body.entry_date === "string" ? body.entry_date : karachiDate(),
          shift: body.shift === "evening" ? "evening" : "morning",
          quantity_liters: Number(body.liters),
          lr: body.lr == null || body.lr === "" ? null : Number(body.lr),
          entry_channel: "app",
          collection_source: "mca_field",
          mca_profile_id: userId,
          created_by: userId,
          client_uuid: item.clientUuid,
          route_name: body.route_name ?? null,
          chiller_name: body.chiller_name ?? null,
          notes: body.notes ?? "Offline app pickup",
          is_test: true,
          status: "pending_fat",
        }, fetch);
        const duplicate = !saved.ok && /client_uuid|duplicate|23505/i.test(saved.detail || "");
        results.push({ clientUuid: item.clientUuid, ok: saved.ok || duplicate, error: saved.ok || duplicate ? undefined : saved.message, offline: !saved.ok && !duplicate && saved.status === 0 });
      }
      setQueue((prev) => applyFlushResult(prev, results));
      setNet(results.some((row) => row.offline) ? "offline" : "online");
      return;
    }
    if (!PORTAL) return;
    const plan = flushPlan(queue, net === "offline" ? "offline" : "online");
    try {
      const res = await fetch(`${PORTAL}/api/mobile/v1/sync`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${access}` },
        body: JSON.stringify({ since: data?.cursor ?? null, items: plan }),
      });
      if (res.status === 401) { setStage("login"); return; }
      const body = await res.json();
      const incoming = Array.isArray(body.milk) ? body.milk : [];
      const merged = mergeById(Array.isArray(data?.milk) ? data.milk : [], incoming);
      const cursor = merged.reduce((max: string | null, row: { at?: string }) => (row.at && (!max || row.at > max) ? row.at : max), data?.cursor ?? null);
      setData({ ...body, milk: merged, cursor });
      setWhatsapp(body.support?.whatsapp?.href ?? whatsapp);
      setNet("online");
      const results = (body.results ?? []).map((row: { clientUuid: string; ok: boolean; error?: string }) => ({ clientUuid: row.clientUuid, ok: row.ok, error: row.error }));
      setQueue((prev) => applyFlushResult(prev, results));
    } catch {
      setNet("offline");
    }
  }

  function onEnqueue(partial: { kind: OutboxItem["kind"]; payload: Record<string, unknown> }) {
    const item: OutboxItem = { clientUuid: uuid(), kind: partial.kind, payload: partial.payload, createdAt: new Date().toISOString() };
    setQueue((prev) => enqueue(prev, item));
  }

  async function sendReport() {
    const ctx = reportContext({
      screen: route,
      route,
      userId,
      role,
      appRole,
      deviceModel: Constants.deviceName ?? "unknown",
      os: `${Constants.platform?.android ? "Android" : "iOS"}`,
      appVersion: VERSION,
      network: net,
      channel: CHANNEL,
    });
    const payload = { text: reportText, context: ctx, photo_base64: shot, voice_base64: voice };
    if (!token || net !== "online" || FLAVOR === "test") {
      onEnqueue({ kind: "feedback", payload });
      setReportOpen(false);
      setReportText("");
      return;
    }
    try {
      const res = await fetch(`${PORTAL}/api/mobile/v1/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: reportText, context: ctx, screenshot_base64: shot, voice_base64: voice }),
      });
      if (!res.ok) onEnqueue({ kind: "feedback", payload });
      setReportOpen(false);
      setReportText("");
      setShot(null);
      setVoice(null);
    } catch {
      onEnqueue({ kind: "feedback", payload });
      setNet("offline");
      setReportOpen(false);
    }
  }

  async function recordVoice() {
    await Audio.requestPermissionsAsync();
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
    await recording.startAsync();
    setTimeout(() => {
      void recording.stopAndUnloadAsync().then(async () => {
        const uri = recording.getURI();
        if (!uri) return;
        const FileSystem = await import("expo-file-system");
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        setVoice(b64);
      });
    }, 4000);
  }

  const Role = screen;
  const nav = appRole ? ROLE_NAV[appRole] : null;
  const previewing = Boolean(homeRole && appRole && appRole !== homeRole && showRolePreview(CHANNEL, role, isTest));
  function backToAdmin() {
    if (!homeRole) return;
    setAppRole(homeRole);
    setTab("home");
    setRoute(`/${homeRole}/home`);
  }
  const startup = elapsed(marks, "js-start", "first-screen");

  if (Platform.OS === "web" && glassPreviewOn()) {
    return (
      <LanguageProvider lang={lang} line={lock.line} mark={lock.title}>
        <GlassPreview />
      </LanguageProvider>
    );
  }

  if (!ready) return <ActivityIndicator style={{ marginTop: 80 }} color={colors.green} />;

  const loginTitle = FLAVOR === "test" ? `${lock.title} TEST` : lock.title;

  return (
    <LanguageProvider lang={lang} line={lock.line} mark={lock.title}>
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      {FLAVOR === "test" ? (
        <View style={styles.flavorBar}>
          <Text style={styles.flavorText}>TEST · testing database</Text>
        </View>
      ) : null}
      {stage !== "app" ? (
        stage === "login" ? (authMode === "login" ? (
          <WebsiteLogin
            title={loginTitle}
            line={lock.line}
            identifier={identifier}
            password={password}
            error={error}
            busy={authBusy}
            version={`Version ${VERSION || "—"}${VERSION_CODE ? ` · ${VERSION_CODE}` : ""} · ${CHANNEL}`}
            onIdentifier={setIdentifier}
            onPassword={setPassword}
            onLogin={() => void login()}
            onSignup={() => { setError(""); setAuthMode("signup"); }}
            onSocial={oauth}
          />
        ) : (
          <WebsiteSignup
            title={loginTitle}
            line={lock.line}
            form={signup}
            error={error}
            busy={authBusy}
            onChange={(key, value) => setSignup((current) => ({ ...current, [key]: value }))}
            onCreate={() => void createAccount()}
            onLogin={() => { setError(""); setAuthMode("login"); }}
            onSocial={oauth}
          />
        )) : stage === "unlock" ? (
          <AppLock title={loginTitle} line={lock.line} role={appRole || role || "User"} pin={pin} error={error} onDigit={(digit) => setPin((current) => current.length < 6 ? `${current}${digit}` : current)} onBackspace={() => setPin((current) => current.slice(0, -1))} onOpen={() => void unlock("pin")} onFingerprint={() => void unlock("biometric")} />
        ) : (
        <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
          <View style={{ marginTop: 24 }}><BrandStack title={loginTitle} line={lock.line} rtl={lock.rtl} titleSize={32} lineSize={16} /></View>
          <Text style={styles.sub}>Version {VERSION || "—"}{VERSION_CODE ? ` · ${VERSION_CODE}` : ""} · {CHANNEL}</Text>
          <LangPick lang={lang} onPick={chooseLang} />
          {stage === "pin" ? (
            <View>
              <Text style={styles.help}>Agli dafa ke liye 4 ya 6 digit PIN.</Text>
              <TextInput value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} style={styles.input} />
              <Btn label="PIN save" onPress={() => void savePin()} />
            </View>
          ) : null}
          {error ? <Text style={styles.err}>{error}</Text> : null}
          {whatsapp ? <Text style={styles.link} onPress={() => void Linking.openURL(whatsapp)}>WhatsApp support</Text> : null}
        </View>
        )
      ) : (
        <View style={{ flex: 1, backgroundColor: "#F7F8F3" }}>
          <View style={{ flex: 1, minHeight: 0 }}>
            {isTest ? (
              <View style={styles.testBar}>
                <Text style={styles.testBadge}>TEST</Text>
                <Text style={styles.testRole}>{appRole ? switchRoleLabel(appRole) : ""}</Text>
                {showRoleSwitch(CHANNEL, isTest) && (tab === "home" || tab === "more") ? (
                  <Pressable onPress={() => setSwitchOpen(true)} style={styles.testBtn}>
                    <Text style={styles.testBtnText}>Role badlo</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {previewing && appRole ? (
              <View style={styles.previewBar}>
                <Text style={styles.previewText}>Preview: {switchRoleLabel(appRole)}</Text>
                <Pressable onPress={backToAdmin} style={styles.testBtn}>
                  <Text style={styles.testBtnText}>Wapas Admin</Text>
                </Pressable>
              </View>
            ) : showRolePreview(CHANNEL, role, isTest) && (tab === "home" || tab === "more") ? (
              <View style={styles.previewBar}>
                <Text style={styles.previewText}>Sirf dekhna</Text>
                <Pressable onPress={() => setPreviewOpen(true)} style={styles.testBtn}>
                  <Text style={styles.testBtnText}>Role dekho</Text>
                </Pressable>
              </View>
            ) : null}
            {Role ? <Role tab={tab} role={appRole} data={data} queue={queue} queueCount={queue.length} onEnqueue={onEnqueue} onSync={() => void sync()} onProfile={() => setProfileOpen(true)} onTab={(key: string) => { setTab(key); if (appRole) setRoute(`/${appRole}/${key}`); }} readOnly={previewing || (isTest && FLAVOR !== "test")} live={{ url: SUPABASE_URL, anonKey: SUPABASE_ANON, token, userId, channel: CHANNEL, flavor: FLAVOR, testAccount: isTest, refreshSession }} /> : <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />}
          </View>
          {nav ? <Tabs tabs={nav.tabs} current={tab} onChange={(key) => { setTab(key); setRoute(`/${appRole}/${key}`); }} /> : null}
          {tab === "more" ? (
            <Text style={styles.perf}>Start {startup ?? "—"} ms · queue {queue.length} · {net}</Text>
          ) : null}
        </View>
      )}

      {showTesterReport(CHANNEL) ? (
        <Pressable style={styles.fab} onPress={() => setReportOpen(true)}>
          <Text style={styles.fabText}>Masla batayein</Text>
        </Pressable>
      ) : null}

      <Modal visible={reportOpen} animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <SafeAreaView style={styles.root}>
          <Header title="Masla batayein" action="Band" onAction={() => setReportOpen(false)} />
          <ScrollView style={{ padding: 16 }}>
            <TextInput value={reportText} onChangeText={setReportText} placeholder="Kya masla hai" multiline style={[styles.input, { minHeight: 100 }]} />
            <Btn label={shot ? "Tasveer lagi" : "Tasveer"} kind="ghost" onPress={() => void ImagePicker.launchCameraAsync({ quality: 0.4, base64: true }).then((picked) => {
              if (!picked.canceled) setShot(picked.assets[0]?.base64 ?? null);
            })} />
            <Btn label={voice ? "Awaaz lagi" : "4 second awaaz"} kind="ghost" onPress={() => void recordVoice()} />
            <Btn label={net === "online" && token ? "Bhejein" : "Queue — baad mein"} onPress={() => void sendReport()} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <SafeAreaView style={styles.root}>
          <Header title="Role dekho" action="Band" onAction={() => setPreviewOpen(false)} />
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.help}>Preview sirf dekhne ke liye hai. Likhai band hai. Jo aap ke admin login ko pehle se dikhta hai, wahi aayega. Baqi jagah khali.</Text>
            {SWITCH_ROLES.map((next) => (
              <Pressable key={next} style={styles.roleRow} onPress={() => {
                setAppRole(next);
                setTab("home");
                setRoute(`/${next}/home`);
                setPreviewOpen(false);
              }}>
                <Text style={{ fontWeight: "700", color: appRole === next ? colors.green : colors.text }}>{switchRoleLabel(next)}{appRole === next ? " · abhi" : ""}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={switchOpen} animationType="slide" onRequestClose={() => setSwitchOpen(false)}>
        <SafeAreaView style={styles.root}>
          <Header title="Role badlo" action="Band" onAction={() => setSwitchOpen(false)} />
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.help}>{FLAVOR === "test" ? "TEST account. MCA ka doodh testing database par likhta hai aur Kisan ki list mein dikhta hai. Asal hisaab nahi khulta." : "TEST account. Har role sirf apni screens dikhata hai. Likhai band hai. Asal hisaab nahi khulta."}</Text>
            {SWITCH_ROLES.map((next) => (
              <Pressable key={next} style={styles.roleRow} onPress={() => {
                setAppRole(next);
                setTab("home");
                setRoute(`/${next}/home`);
                setSwitchOpen(false);
                void SecureStore.getItemAsync("agribridge.session").then((raw) => {
                  if (!raw) return;
                  const saved = JSON.parse(raw) as Record<string, unknown>;
                  saved.appRole = next;
                  saved.isTest = true;
                  return SecureStore.setItemAsync("agribridge.session", JSON.stringify(saved));
                });
              }}>
                <Text style={{ fontWeight: "700", color: appRole === next ? colors.green : colors.text }}>{switchRoleLabel(next)}{appRole === next ? " · abhi" : ""}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={profileOpen} animationType="slide" onRequestClose={() => setProfileOpen(false)}>
        <ProfileSheet
          url={SUPABASE_URL}
          anonKey={SUPABASE_ANON}
          token={token}
          userId={userId}
          channel={CHANNEL}
          flavor={FLAVOR}
          testAccount={isTest}
          version={VERSION}
          versionCode={VERSION_CODE}
          lang={lang}
          onLang={chooseLang}
          onSupport={() => { setProfileOpen(false); setSupportOpen(true); }}
          onClose={() => setProfileOpen(false)}
        />
      </Modal>

      <Modal visible={supportOpen} animationType="slide" onRequestClose={() => setSupportOpen(false)}>
        <SupportSheet
          portal={PORTAL}
          token={token}
          chat={data?.support?.chat ?? null}
          whatsapp={whatsapp}
          channel={CHANNEL}
          flavor={FLAVOR}
          onClose={() => setSupportOpen(false)}
        />
      </Modal>
    </SafeAreaView>
    </LanguageProvider>
  );
}

function LangPick({ lang, onPick }: { lang: AppLang; onPick: (lang: AppLang) => void }) {
  const items: { id: AppLang; label: string }[] = [
    { id: "en", label: "EN" },
    { id: "rm", label: "Roman" },
    { id: "ur", label: "اردو" },
  ];
  return (
    <View style={{ flexDirection: "row", marginBottom: 12 }}>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => onPick(item.id)} style={{ marginRight: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: lang === item.id ? "#146B3A" : "transparent", borderWidth: 1, borderColor: "#3DDC97" }}>
          <Text style={{ color: colors.text, fontWeight: "700", writingDirection: item.id === "ur" ? "rtl" : "ltr" }}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ProfileSheet({ url, anonKey, token, userId, channel, flavor, testAccount, version, versionCode, lang, onLang, onSupport, onClose }: { url: string; anonKey: string; token: string | null; userId: string | null; channel: ReturnType<typeof normalizeChannel>; flavor: ReturnType<typeof dataFlavor>; testAccount: boolean; version: string; versionCode: number; lang: AppLang; onLang: (lang: AppLang) => void; onSupport: () => void; onClose: () => void }) {
  const [displayId, setDisplayId] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  useEffect(() => {
    void SecureStore.getItemAsync("agribridge.displayId").then((value) => { if (value) setDisplayId(value); });
    if (!token) return;
    const auth = { url, anonKey, token, channel, flavor, testAccount, userId };
    void (async () => {
      let path = "milk_entries?select=entry_date,shift,quantity_liters,status&order=entry_date.desc&limit=5";
      if (testAccount) {
        const farmerId = await loadMyFarmerId(auth, fetch);
        if (!farmerId) { setNotes(["Is login ka kisan record nahi mila."]); return; }
        path += `&farmer_id=eq.${encodeURIComponent(farmerId)}`;
      }
      const rows = await liveGetScoped<MilkRow>(auth, path, fetch);
      if (!rows.ok) { setNotes([rows.message]); return; }
      setNotes(rows.rows.length ? rows.rows.map((row) => `Doodh · ${row.entry_date} · ${row.shift === "evening" ? "Shaam" : "Subah"} · ${row.quantity_liters ?? "—"} L`) : ["Koi notification nahi"]);
    })();
  }, [url, anonKey, token, userId, channel, flavor, testAccount]);
  return (
    <SafeAreaView style={styles.root}>
      <Header title="Profile" action="Band" onAction={onClose} />
      <ScrollView style={{ padding: 16 }}>
        <Text style={styles.help}>User ID (ikhtiyari). Login ka password nahi. Sirf is phone par naam.</Text>
        <TextInput
          value={displayId}
          onChangeText={setDisplayId}
          onEndEditing={() => { void SecureStore.setItemAsync("agribridge.displayId", displayId.trim()); }}
          placeholder="User ID"
          autoCapitalize="none"
          style={styles.input}
        />
        <Text style={styles.help}>Zuban</Text>
        <LangPick lang={lang} onPick={onLang} />
        <Text style={styles.help}>Account · {userId || "—"}</Text>
        <Text style={styles.help}>Settings · Version {version || "—"} · {versionCode || "—"} · {channel} · {flavor === "test" ? "TEST database" : "live database"}</Text>
        <Text style={styles.help}>PIN aur fingerprint login ke unlock par hain. Yahan se band nahi hote.</Text>
        <Text style={{ fontWeight: "800", color: colors.text, marginTop: 12 }}>Notifications</Text>
        {notes.map((line, index) => <Text key={`${index}-${line}`} style={{ color: colors.text, marginTop: 6 }}>{line}</Text>)}
        <Btn label="Support" kind="ghost" onPress={onSupport} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SupportSheet({ portal, token, chat, whatsapp, channel, flavor, onClose }: { portal: string; token: string | null; chat: string | null; whatsapp: string | null; channel: ReturnType<typeof normalizeChannel>; flavor: ReturnType<typeof dataFlavor>; onClose: () => void }) {
  const [text, setText] = useState("");
  const [log, setLog] = useState<string[]>([]);
  async function ask() {
    if (flavor === "test" || !token || !chat || !portal) return;
    setLog((prev) => [...prev, `Aap: ${text}`]);
    const message = text;
    setText("");
    try {
      const res = await fetch(`${portal}${chat}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ message }),
      });
      const raw = await res.text();
      let body: { answer?: string; reply?: string; error?: string } = {};
      try { body = JSON.parse(raw); } catch { body = {}; }
      if (res.ok && (body.answer || body.reply)) {
        setLog((prev) => [...prev, body.answer || body.reply || ""]);
        return;
      }
      setLog((prev) => [...prev, failureLine({ channel, fallback: body.error || "Jawab nahi aaya.", status: res.status, detail: raw })]);
    } catch (err) {
      setLog((prev) => [...prev, failureLine({ channel, fallback: "Network nahi mila.", detail: err instanceof Error ? err.message : "fetch failed" })]);
    }
  }
  return (
    <SafeAreaView style={styles.root}>
      <Header title="Support" action="Band" onAction={onClose} />
      <ScrollView style={{ padding: 16 }}>
        {chat && token ? (
          <View>
            <Text style={styles.help}>Portal ka support chat.</Text>
            {log.map((line, i) => <Text key={i} style={{ marginBottom: 8, color: colors.text }}>{line}</Text>)}
            <TextInput value={text} onChangeText={setText} placeholder="Sawal" style={styles.input} />
            <Btn label="Bhejein" onPress={() => void ask()} />
          </View>
        ) : <Text style={styles.help}>{flavor === "test" ? "TEST build portal chat nahi kholta. Login seedha testing database par hai." : "Is account par chat login ke baad khulta hai."}</Text>}
        {whatsapp ? <Text style={styles.link} onPress={() => void Linking.openURL(whatsapp)}>WhatsApp kholen</Text> : <Text style={styles.help}>WhatsApp number settings mein nahi.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F8F3" },
  brand: { fontSize: 32, fontWeight: "800", color: colors.green, marginTop: 24 },
  sub: { color: colors.muted, marginBottom: 16 },
  help: { color: colors.muted, marginBottom: 8 },
  input: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12, marginTop: 8 },
  err: { color: colors.danger, marginTop: 12 },
  link: { color: colors.green, marginTop: 16, fontWeight: "700" },
  fab: { position: "absolute", right: 16, bottom: 72, backgroundColor: colors.greenDark, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 },
  fabText: { color: "#fff", fontWeight: "700" },
  perf: { textAlign: "center", color: colors.muted, fontSize: 11, paddingBottom: 4 },
  flavorBar: { backgroundColor: "#C2410C", paddingVertical: 8, paddingHorizontal: 16 },
  flavorText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  testBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#F4E4C4" },
  previewBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#E7F2E4" },
  previewText: { flex: 1, color: colors.greenDark, fontWeight: "800" },
  testBadge: { backgroundColor: "#7A4E00", color: "#fff", fontWeight: "800", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: "hidden" },
  testRole: { flex: 1, color: "#3d2e10", fontWeight: "700" },
  testBtn: { backgroundColor: colors.green, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  testBtnText: { color: "#fff", fontWeight: "700" },
  roleRow: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.line },
});
