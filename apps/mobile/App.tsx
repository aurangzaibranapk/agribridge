import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { normalizeChannel, showTesterReport } from "../../src/lib/mobile/channel";
import { failureLine, signInMobile } from "../../src/lib/mobile/live-login";
import { ROLE_NAV } from "../../src/lib/mobile/nav";
import type { AppRole } from "../../src/lib/mobile/roles";
import { pinLock, pinProblem } from "../../src/lib/mobile/pin";
import { applyFlushResult, enqueue, flushPlan, type OutboxItem } from "../../src/lib/mobile/queue";
import { reportContext } from "../../src/lib/mobile/report";
import { elapsed } from "../../src/lib/mobile/perf";
import { mergeById, type NetState } from "../../src/lib/mobile/sync";
import { bootMark, marks } from "./src/boot";
import { loadRoleModule } from "./src/roles/load";
import { Btn, Header, Tabs, colors } from "./src/kit";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  productVersion?: string;
  versionCode?: number;
  appChannel?: string;
  portalUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};
const VERSION = extra.productVersion || "";
const VERSION_CODE = extra.versionCode || 0;
const CHANNEL = normalizeChannel(extra.appChannel);
const PORTAL = (extra.portalUrl || "").replace(/\/$/, "");
const SUPABASE_URL = extra.supabaseUrl || "";
const SUPABASE_ANON = extra.supabaseAnonKey || "";

async function sha(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

function uuid() {
  return Crypto.randomUUID();
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
  const [reportText, setReportText] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  useEffect(() => {
    bootMark("first-screen");
    void (async () => {
      const saved = await SecureStore.getItemAsync("agribridge.session");
      const pinHash = await SecureStore.getItemAsync("agribridge.pin");
      if (saved && pinHash) {
        const session = JSON.parse(saved);
        setToken(session.token);
        setRole(session.role);
        setAppRole(session.appRole);
        setUserId(session.userId);
        setStage("unlock");
        setRoute("/unlock");
      }
      setReady(true);
      if (!PORTAL) return;
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
    const result = await signInMobile({
      identifier,
      password,
      portalUrl: PORTAL,
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON,
      channel: CHANNEL,
      fetchImpl: (url, init) => fetch(url, init),
    });
    if (!result.ok) {
      if (result.offline) setNet("offline");
      setError(result.message);
      return;
    }
    const body = result.session;
    setToken(body.access_token);
    setRole(body.role);
    setAppRole(body.appRole);
    setUserId(body.user_id);
    await SecureStore.setItemAsync("agribridge.session", JSON.stringify({ token: body.access_token, refresh: body.refresh_token, role: body.role, appRole: body.appRole, userId: body.user_id }));
    setPassword("");
    setNet("online");
    setStage("pin");
    setRoute("/pin");
  }

  async function savePin() {
    const problem = pinProblem(pin);
    if (problem) { setError(problem); return; }
    const salt = uuid();
    const hash = await sha(`${salt}:${pin}`);
    await SecureStore.setItemAsync("agribridge.pin", JSON.stringify({ salt, hash }));
    setPin("");
    setStage("app");
    setRoute(`/${appRole}/home`);
    void sync(token);
  }

  async function unlock(method: "pin" | "biometric") {
    const now = Date.now();
    if (lockedUntil && now < lockedUntil) { setError("PIN thori der band hai."); return; }
    if (method === "biometric") {
      const bio = await LocalAuthentication.authenticateAsync({ promptMessage: "AgriBridge kholen" });
      if (bio.success) { setStage("app"); setRoute(`/${appRole}/home`); void sync(token); return; }
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
    setStage("app");
    setRoute(`/${appRole}/home`);
    void sync(token);
  }

  async function sync(access = token) {
    if (!access || !PORTAL) return;
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
    if (!token || net !== "online") {
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
  const startup = elapsed(marks, "js-start", "first-screen");

  if (!ready) return <ActivityIndicator style={{ marginTop: 80 }} color={colors.green} />;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {stage !== "app" ? (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.brand}>AgriBridge</Text>
          <Text style={styles.sub}>Version {VERSION || "—"}{VERSION_CODE ? ` · ${VERSION_CODE}` : ""} · {CHANNEL}</Text>
          {stage === "login" ? (
            <View>
              <TextInput value={identifier} onChangeText={setIdentifier} placeholder="ID, mobile ya CNIC" autoCapitalize="none" style={styles.input} />
              <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} />
              <Btn label="Login" onPress={() => void login()} />
            </View>
          ) : null}
          {stage === "pin" ? (
            <View>
              <Text style={styles.help}>Agli dafa ke liye 4 ya 6 digit PIN.</Text>
              <TextInput value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} style={styles.input} />
              <Btn label="PIN save" onPress={() => void savePin()} />
            </View>
          ) : null}
          {stage === "unlock" ? (
            <View>
              <TextInput value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="PIN" style={styles.input} />
              <Btn label="PIN se kholen" onPress={() => void unlock("pin")} />
              <Btn label="Fingerprint" kind="gold" onPress={() => void unlock("biometric")} />
            </View>
          ) : null}
          {error ? <Text style={styles.err}>{error}</Text> : null}
          {whatsapp ? <Text style={styles.link} onPress={() => void Linking.openURL(whatsapp)}>WhatsApp support</Text> : null}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <Header
            title={nav?.title ?? "AgriBridge"}
            action="Support"
            onAction={() => setSupportOpen(true)}
          />
          <View style={{ flex: 1 }}>
            {Role ? <Role tab={tab} role={appRole} data={data} queueCount={queue.length} onEnqueue={onEnqueue} onSync={() => void sync()} live={{ url: SUPABASE_URL, anonKey: SUPABASE_ANON, token, userId, channel: CHANNEL }} /> : <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />}
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

      <Modal visible={supportOpen} animationType="slide" onRequestClose={() => setSupportOpen(false)}>
        <SupportSheet
          portal={PORTAL}
          token={token}
          chat={data?.support?.chat ?? null}
          whatsapp={whatsapp}
          channel={CHANNEL}
          onClose={() => setSupportOpen(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

function SupportSheet({ portal, token, chat, whatsapp, channel, onClose }: { portal: string; token: string | null; chat: string | null; whatsapp: string | null; channel: ReturnType<typeof normalizeChannel>; onClose: () => void }) {
  const [text, setText] = useState("");
  const [log, setLog] = useState<string[]>([]);
  async function ask() {
    if (!token || !chat || !portal) return;
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
        ) : <Text style={styles.help}>Is account par chat login ke baad khulta hai.</Text>}
        {whatsapp ? <Text style={styles.link} onPress={() => void Linking.openURL(whatsapp)}>WhatsApp kholen</Text> : <Text style={styles.help}>WhatsApp number settings mein nahi.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  brand: { fontSize: 32, fontWeight: "800", color: colors.green, marginTop: 24 },
  sub: { color: colors.muted, marginBottom: 16 },
  help: { color: colors.muted, marginBottom: 8 },
  input: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12, marginTop: 8 },
  err: { color: colors.danger, marginTop: 12 },
  link: { color: colors.green, marginTop: 16, fontWeight: "700" },
  fab: { position: "absolute", right: 16, bottom: 72, backgroundColor: colors.greenDark, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10 },
  fabText: { color: "#fff", fontWeight: "700" },
  perf: { textAlign: "center", color: colors.muted, fontSize: 11, paddingBottom: 4 },
});
