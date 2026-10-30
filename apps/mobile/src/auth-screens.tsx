import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "./kit";

export function AppLock({ title, line, role, pin, error, onDigit, onBackspace, onOpen, onFingerprint }: { title: string; line: string; role: string; pin: string; error: string; onDigit: (digit: string) => void; onBackspace: () => void; onOpen: () => void; onFingerprint: () => void }) {
  return <View style={styles.lockRoot}>
    <View style={styles.lockLogo}><Text style={styles.lockLogoText}>♧</Text></View><Text style={styles.lockBrand}>{title}</Text><Text style={styles.lockTag}>{line}</Text>
    <View style={styles.lockCard}>
      <View style={styles.lockUser}><View style={styles.lockAvatar}><Text style={styles.lockAvatarText}>AB</Text></View><View><Text style={styles.lockName}>AgriBridge account</Text><Text style={styles.lockRole}>{role || "User"}</Text></View></View>
      <View style={styles.dots}>{[0, 1, 2, 3, 4, 5].map((index) => <View key={index} style={[styles.dot, index < pin.length && styles.dotOn]} />)}</View>
      <View style={styles.keypad}>{["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map((key) => <Pressable key={key} onPress={() => key === "⌫" ? onBackspace() : key === "✓" ? onOpen() : onDigit(key)} style={styles.key}><Text style={styles.keyText}>{key}</Text></Pressable>)}</View>
      <Pressable onPress={onFingerprint} style={styles.primary}><Text style={styles.primaryText}>Fingerprint / PIN se kholen</Text></Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  </View>;
}

type LoginProps = {
  title: string;
  line: string;
  identifier: string;
  password: string;
  error: string;
  busy: boolean;
  version: string;
  onIdentifier: (value: string) => void;
  onPassword: (value: string) => void;
  onLogin: () => void;
  onForgot: () => void;
  onSignup: () => void;
  onSocial: (provider: "google" | "facebook") => void;
};

export function WebsiteLogin(props: LoginProps) {
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
    <View style={styles.header}><View style={styles.logo}><Text style={styles.logoMark}>♧</Text></View><View><Text style={styles.brand}>{props.title}</Text><Text style={styles.tag}>{props.line}</Text></View></View>
    <View style={styles.signupStrip}><View style={{ flex: 1 }}><Text style={styles.stripTitle}>Naye hain?</Text><Text style={styles.stripSub}>Kisan / customer account banayein</Text></View><Pressable onPress={props.onSignup} style={styles.stripButton}><Text style={styles.stripButtonText}>Sign up</Text></Pressable></View>
    <View style={styles.card}>
      <Text style={styles.heading}>Welcome back</Text><Text style={styles.lead}>Apna AgriBridge account kholen</Text>
      <TextInput value={props.identifier} onChangeText={props.onIdentifier} placeholder="Mobile ya email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput value={props.password} onChangeText={props.onPassword} placeholder="Password" secureTextEntry style={styles.input} />
      <Pressable disabled={props.busy} onPress={props.onForgot}><Text style={styles.forgot}>Password bhool gaye?</Text></Pressable>
      <Pressable disabled={props.busy} onPress={props.onLogin} style={[styles.primary, props.busy && styles.disabled]}><Text style={styles.primaryText}>{props.busy ? "Login ho raha hai…" : "Login"}</Text></Pressable>
      <View style={styles.or}><View style={styles.line} /><Text style={styles.orText}>ya</Text><View style={styles.line} /></View>
      <View style={styles.socialRow}><Social label="G  Google" onPress={() => props.onSocial("google")} /><Social label="f  Facebook" onPress={() => props.onSocial("facebook")} /></View>
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
    </View>
    <Text style={styles.version}>{props.version}</Text>
  </KeyboardAvoidingView>;
}

export function WebsiteReset({ title, line, password, error, busy, onPassword, onSave, onLogin }: { title: string; line: string; password: string; error: string; busy: boolean; onPassword: (value: string) => void; onSave: () => void; onLogin: () => void }) {
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
    <View style={styles.header}><View style={styles.logo}><Text style={styles.logoMark}>♧</Text></View><View style={{ flex: 1 }}><Text style={styles.brand}>{title}</Text><Text style={styles.tag}>{line}</Text></View><Pressable onPress={onLogin}><Text style={styles.loginLink}>Login</Text></Pressable></View>
    <View style={styles.card}>
      <Text style={styles.heading}>Naya password</Text><Text style={styles.lead}>Kam az kam 8 huroof ka naya password likhein</Text>
      <TextInput value={password} onChangeText={onPassword} placeholder="Naya password" secureTextEntry style={styles.input} />
      <Pressable disabled={busy} onPress={onSave} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? "Save ho raha hai…" : "Password update karein"}</Text></Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  </KeyboardAvoidingView>;
}

export type SignUpForm = { fullName: string; email: string; phone: string; cnic: string; password: string };
type SignupProps = {
  title: string;
  line: string;
  form: SignUpForm;
  error: string;
  busy: boolean;
  onChange: (key: keyof SignUpForm, value: string) => void;
  onCreate: () => void;
  onLogin: () => void;
  onSocial: (provider: "google" | "facebook") => void;
};

export function WebsiteSignup(props: SignupProps) {
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
    <View style={styles.header}><View style={styles.logo}><Text style={styles.logoMark}>♧</Text></View><View style={{ flex: 1 }}><Text style={styles.brand}>{props.title}</Text><Text style={styles.tag}>{props.line}</Text></View><Pressable onPress={props.onLogin}><Text style={styles.loginLink}>Login</Text></Pressable></View>
    <View style={[styles.card, styles.signupCard]}>
      <Text style={styles.heading}>Apna account banayein</Text><Text style={styles.lead}>Farmer aur customer ek hi profile hain</Text>
      <View style={styles.two}><TextInput value={props.form.fullName} onChangeText={(v) => props.onChange("fullName", v)} placeholder="Poora naam" style={[styles.input, styles.half]} /><TextInput value={props.form.email} onChangeText={(v) => props.onChange("email", v)} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={[styles.input, styles.half]} /></View>
      <View style={styles.two}><TextInput value={props.form.phone} onChangeText={(v) => props.onChange("phone", v)} placeholder="Mobile" keyboardType="phone-pad" style={[styles.input, styles.half]} /><TextInput value={props.form.cnic} onChangeText={(v) => props.onChange("cnic", v)} placeholder="CNIC (optional)" keyboardType="number-pad" style={[styles.input, styles.half]} /></View>
      <TextInput value={props.form.password} onChangeText={(v) => props.onChange("password", v)} placeholder="Password · kam az kam 8" secureTextEntry style={styles.input} />
      <Text style={styles.channelLabel}>Code kis tarah mangwayein?</Text><View style={styles.channelRow}><Pressable onPress={() => setChannel("sms")} style={[styles.channel, channel === "sms" && styles.channelOn]}><Text style={[styles.channelText, channel === "sms" && styles.channelTextOn]}>SMS · 4 digits</Text></Pressable><Pressable onPress={() => setChannel("whatsapp")} style={[styles.channel, channel === "whatsapp" && styles.channelOn]}><Text style={[styles.channelText, channel === "whatsapp" && styles.channelTextOn]}>WhatsApp · 6 digits</Text></Pressable></View>
      <Pressable disabled={props.busy} onPress={props.onCreate} style={[styles.primary, props.busy && styles.disabled]}><Text style={styles.primaryText}>{props.busy ? "Account ban raha hai…" : "Create account"}</Text></Pressable>
      <View style={styles.or}><View style={styles.line} /><Text style={styles.orText}>ya continue</Text><View style={styles.line} /></View>
      <View style={styles.socialRow}><Social label="G  Google" onPress={() => props.onSocial("google")} /><Social label="f  Facebook" onPress={() => props.onSocial("facebook")} /></View>
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
    </View>
    <Text style={styles.terms}>Account bana kar aap AgriBridge terms aur privacy se agree karte hain.</Text>
  </KeyboardAvoidingView>;
}

function Social({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.social}><Text style={styles.socialText}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  lockRoot: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#F7F9F4" },
  lockLogo: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  lockLogoText: { color: "#fff", fontSize: 34, fontWeight: "900" },
  lockBrand: { color: colors.greenDark, fontSize: 28, fontWeight: "900", marginTop: 8 },
  lockTag: { color: colors.muted, marginTop: 2, marginBottom: 14 },
  lockCard: { width: "100%", maxWidth: 410, backgroundColor: "#fff", borderRadius: 24, padding: 16, borderWidth: 1, borderColor: colors.line },
  lockUser: { flexDirection: "row", alignItems: "center" },
  lockAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#D5E8D6", alignItems: "center", justifyContent: "center", marginRight: 10 },
  lockAvatarText: { color: colors.greenDark, fontWeight: "900" },
  lockName: { color: colors.text, fontWeight: "900" },
  lockRole: { color: colors.muted, fontSize: 12, marginTop: 2, textTransform: "capitalize" },
  dots: { flexDirection: "row", justifyContent: "center", marginVertical: 14 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#D9E0D9", marginHorizontal: 5 },
  dotOn: { backgroundColor: colors.green },
  keypad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  key: { width: "30%", height: 42, borderRadius: 13, backgroundColor: "#F2F6F1", alignItems: "center", justifyContent: "center", marginBottom: 7 },
  keyText: { color: colors.text, fontSize: 18, fontWeight: "800" },
  root: { flex: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, justifyContent: "center", backgroundColor: "#F7F9F4" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  logo: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", marginRight: 10 },
  logoMark: { color: "#fff", fontSize: 26, fontWeight: "900" },
  brand: { color: colors.greenDark, fontSize: 22, fontWeight: "900" },
  tag: { color: colors.muted, fontSize: 12, marginTop: 2 },
  loginLink: { color: colors.green, fontWeight: "900", padding: 10 },
  signupStrip: { flexDirection: "row", alignItems: "center", borderRadius: 18, backgroundColor: "#E4F2E3", padding: 12, marginBottom: 12 },
  stripTitle: { color: colors.greenDark, fontWeight: "900" },
  stripSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  stripButton: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14 },
  stripButtonText: { color: "#fff", fontWeight: "900" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 17, borderWidth: 1, borderColor: colors.line },
  signupCard: { paddingVertical: 15 },
  heading: { color: colors.text, fontSize: 23, fontWeight: "900" },
  lead: { color: colors.muted, fontSize: 12, marginTop: 3, marginBottom: 8 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, backgroundColor: "#F8FAF7", borderRadius: 14, paddingHorizontal: 12, marginTop: 8, color: colors.text },
  channelLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 8 },
  channelRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  channel: { width: "48.5%", borderRadius: 11, borderWidth: 1, borderColor: colors.line, paddingVertical: 7, alignItems: "center" },
  channelOn: { backgroundColor: "#E7F2E4", borderColor: colors.green },
  channelText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  channelTextOn: { color: colors.greenDark },
  two: { flexDirection: "row", justifyContent: "space-between" },
  half: { width: "48.5%" },
  forgot: { color: colors.green, fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 9 },
  primary: { minHeight: 48, backgroundColor: colors.green, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 12 },
  primaryText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.6 },
  or: { flexDirection: "row", alignItems: "center", marginVertical: 12 },
  line: { height: 1, backgroundColor: colors.line, flex: 1 },
  orText: { color: colors.muted, fontSize: 11, marginHorizontal: 9 },
  socialRow: { flexDirection: "row", justifyContent: "space-between" },
  social: { width: "48.5%", minHeight: 43, borderWidth: 1, borderColor: colors.line, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  socialText: { color: colors.text, fontWeight: "800" },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 10, textAlign: "center" },
  version: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 10 },
  terms: { color: colors.muted, fontSize: 10, textAlign: "center", marginTop: 10, lineHeight: 14 },
});
