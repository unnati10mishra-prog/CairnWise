import AsyncStorage from "@react-native-async-storage/async-storage";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ApiError,
  Brand,
  CairnwiseApi,
  Candidate,
  CaseRecord,
  Coverage,
  Evidence,
  ReportDraft,
  Workspace,
} from "./src/api";

WebBrowser.maybeCompleteAuthSession();

const ACCESS_TOKEN_KEY = "cairnwise.supabase.access_token";
const redirectUri = makeRedirectUri({ scheme: "cairnwise", path: "auth/callback" });
const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const supabaseKey = (
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""
).trim();
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

function firstParam(value: string | string[] | null | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function callbackParams(url: string): { code?: string; access_token?: string; refresh_token?: string; error?: string } {
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const hashParams = new URLSearchParams(hash);
  return {
    code: firstParam(query.code as string | string[] | null | undefined),
    access_token:
      firstParam(query.access_token as string | string[] | null | undefined) ?? hashParams.get("access_token") ?? undefined,
    refresh_token:
      firstParam(query.refresh_token as string | string[] | null | undefined) ?? hashParams.get("refresh_token") ?? undefined,
    error: firstParam(query.error as string | string[] | null | undefined) ?? hashParams.get("error") ?? undefined,
  };
}

function displayError(error: unknown): string {
  if (error instanceof ApiError) return `${error.message}${error.status ? ` (HTTP ${error.status})` : ""}`;
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function stateLabel(state: string | undefined): string {
  return (state ?? "unknown").replaceAll("_", " ");
}

function Button({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);

  const configurationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!apiBaseUrl) issues.push("EXPO_PUBLIC_API_BASE_URL");
    if (!supabaseUrl) issues.push("EXPO_PUBLIC_SUPABASE_URL");
    if (!supabaseKey) issues.push("EXPO_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    return issues;
  }, []);

  const api = useMemo(() => (session && apiBaseUrl ? new CairnwiseApi(apiBaseUrl, session.access_token) : null), [session]);

  const refreshBrand = useCallback(async (nextBrand: Brand, nextApi: CairnwiseApi) => {
    setBusy(true);
    setError(null);
    setBrand(nextBrand);
    setSelectedCandidate(null);
    setEvidence([]);
    setReportDraft(null);
    try {
      const [candidateResponse, coverageResponse] = await Promise.all([
        nextApi.listCandidates(nextBrand.id),
        nextApi.getCoverage(nextBrand.id),
      ]);
      setCandidates(candidateResponse.items ?? []);
      setCoverage(coverageResponse);
    } catch (requestError) {
      setError(displayError(requestError));
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshWorkspace = useCallback(async (nextWorkspace: Workspace, nextApi: CairnwiseApi) => {
    setWorkspace(nextWorkspace);
    setBrand(null);
    setBrands([]);
    setCandidates([]);
    setCoverage(null);
    setBusy(true);
    setError(null);
    try {
      const response = await nextApi.listBrands(nextWorkspace.id);
      setBrands(response.items ?? []);
      if (response.items?.[0]) await refreshBrand(response.items[0], nextApi);
    } catch (requestError) {
      setError(displayError(requestError));
      setBusy(false);
    }
  }, [refreshBrand]);

  const loadAccount = useCallback(async (nextSession: Session) => {
    if (!apiBaseUrl) return;
    const nextApi = new CairnwiseApi(apiBaseUrl, nextSession.access_token);
    setBusy(true);
    setError(null);
    try {
      const response = await nextApi.authMe();
      setWorkspaces(response.workspaces ?? []);
      if (response.workspaces?.[0]) await refreshWorkspace(response.workspaces[0], nextApi);
      else setBusy(false);
    } catch (requestError) {
      setError(displayError(requestError));
      setBusy(false);
    }
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!supabase) return undefined;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        void AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.session.access_token);
        void loadAccount(data.session);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void AsyncStorage.setItem(ACCESS_TOKEN_KEY, nextSession.access_token);
        void loadAccount(nextSession);
      } else {
        void AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [loadAccount]);

  const signIn = async () => {
    if (!supabase) return;
    setAuthBusy(true);
    setError(null);
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error("Supabase did not return a Google authorization URL.");
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (result.type !== "success" || !result.url) throw new Error("Google sign-in was cancelled or did not return to Cairnwise.");
      const params = callbackParams(result.url);
      if (params.error) throw new Error(`Supabase OAuth error: ${params.error}`);
      if (params.code) {
        const exchanged = await supabase.auth.exchangeCodeForSession(params.code);
        if (exchanged.error) throw exchanged.error;
      } else if (params.access_token && params.refresh_token) {
        const established = await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
        if (established.error) throw established.error;
      } else {
        throw new Error("The OAuth callback did not contain a Supabase session. Check the mobile redirect allow-list.");
      }
      const current = await supabase.auth.getSession();
      setSession(current.data.session);
    } catch (authError) {
      setError(displayError(authError));
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setWorkspaces([]);
    setBrands([]);
    setCandidates([]);
    setCoverage(null);
    setSelectedCandidate(null);
  };

  const selectCandidate = async (candidate: Candidate) => {
    if (!api) return;
    setSelectedCandidate(candidate);
    setReportDraft(null);
    setError(null);
    try {
      const [fullCandidate, evidenceResponse] = await Promise.all([
        api.getCandidate(candidate.id),
        api.getEvidence(candidate.id),
      ]);
      setSelectedCandidate(fullCandidate);
      setEvidence(evidenceResponse.items ?? fullCandidate.evidence ?? []);
    } catch (requestError) {
      setError(displayError(requestError));
    }
  };

  const openCase = async () => {
    if (!api || !selectedCandidate) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createCase(selectedCandidate.id);
      setSelectedCandidate((current) => (current ? { ...current, case: created } : current));
    } catch (requestError) {
      setError(displayError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const recordDecision = async (disposition: string) => {
    if (!api || !selectedCandidate?.case) return;
    if (!decisionReason.trim()) {
      setError("Add a reason before recording a decision.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.recordDecision(selectedCandidate.case.id, disposition, decisionReason.trim());
      setSelectedCandidate((current) => (current ? { ...current, case: updated } : current));
      setDecisionReason("");
    } catch (requestError) {
      setError(displayError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const createReport = async () => {
    if (!api || !selectedCandidate?.case) return;
    setBusy(true);
    setError(null);
    try {
      setReportDraft(await api.createReportDraft(selectedCandidate.case.id));
    } catch (requestError) {
      setError(displayError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const unavailable =
    selectedCandidate?.latest_observation?.availability_state === "unavailable" ||
    coverage?.connectors?.some((item) => item.state === "unavailable") === true;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>CAIRNWISE / MOBILE</Text>
            <Text style={styles.title}>Evidence review</Text>
            <Text style={styles.subtitle}>A small client for the versioned Cairnwise API.</Text>
          </View>
          {session && <Button label="Sign out" secondary onPress={() => void signOut()} />}
        </View>

        {configurationIssues.length > 0 && (
          <View style={styles.warning}>
            <Text style={styles.warningTitle}>Mobile setup is incomplete</Text>
            <Text style={styles.warningText}>Set these public values in mobile/.env: {configurationIssues.join(", ")}.</Text>
            <Text style={styles.warningText}>Use Supabase anon/publishable key only. Never put a service key or JWT secret in Expo.</Text>
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}

        {!session ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sign in with Google</Text>
            <Text style={styles.body}>Cairnwise opens Supabase OAuth and returns through the cairnwise://auth/callback deep link.</Text>
            <Button label={authBusy ? "Opening Google…" : "Continue with Google"} disabled={authBusy || !supabase || configurationIssues.length > 0} onPress={() => void signIn()} />
            {(!supabase || configurationIssues.length > 0) && <Text style={styles.muted}>OAuth is disabled until all public mobile environment values are configured.</Text>}
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Workspace</Text>
              <View style={styles.chips}>
                {workspaces.map((item) => (
                  <Pressable key={item.id} onPress={() => api && void refreshWorkspace(item, api)} style={[styles.chip, workspace?.id === item.id && styles.chipSelected]}>
                    <Text style={[styles.chipText, workspace?.id === item.id && styles.chipTextSelected]}>{item.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.sectionTitle}>Brand</Text>
              <View style={styles.chips}>
                {brands.map((item) => (
                  <Pressable key={item.id} onPress={() => api && void refreshBrand(item, api)} style={[styles.chip, brand?.id === item.id && styles.chipSelected]}>
                    <Text style={[styles.chipText, brand?.id === item.id && styles.chipTextSelected]}>{item.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {unavailable && (
              <View style={styles.outage}>
                <Text style={styles.outageTitle}>Source unavailable</Text>
                <Text style={styles.body}>A source is unavailable or not enabled. Cairnwise keeps this explicit; it is not an all-clear and should not be treated as live coverage.</Text>
              </View>
            )}

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Review queue</Text>
                {busy && <ActivityIndicator color="#7c5cff" />}
              </View>
              {candidates.length === 0 ? (
                <Text style={styles.muted}>No candidates are available for this brand.</Text>
              ) : (
                candidates.map((item) => {
                  const assessment = item.latest_assessment;
                  const sourceMode = item.latest_observation?.source_mode ?? item.source_mode ?? "unknown";
                  return (
                    <Pressable key={item.id} onPress={() => void selectCandidate(item)} style={[styles.queueItem, selectedCandidate?.id === item.id && styles.queueItemSelected]}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.queueTitle}>{String(item.source_identity ?? item.canonical_locator ?? item.id)}</Text>
                        <Text style={styles.badge}>{stateLabel(assessment?.decision_state)}</Text>
                      </View>
                      <Text style={styles.muted}>{item.asset_type ?? "candidate"} · source mode: {sourceMode}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>

            {selectedCandidate && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Candidate evidence</Text>
                <Text style={styles.body}>{String(selectedCandidate.canonical_locator ?? selectedCandidate.source_identity ?? selectedCandidate.id)}</Text>
                <Text style={styles.muted}>Source mode: {selectedCandidate.latest_observation?.source_mode ?? selectedCandidate.source_mode ?? "unknown"}</Text>
                {selectedCandidate.latest_observation?.availability_state === "unavailable" && <Text style={styles.outageInline}>This candidate’s source is unavailable.</Text>}
                <Text style={styles.subheading}>Independent dimensions</Text>
                {Object.entries(selectedCandidate.latest_assessment?.dimensions ?? {}).map(([name, value]) => (
                  <View key={name} style={styles.dimension}>
                    <Text style={styles.dimensionName}>{stateLabel(name)}</Text>
                    <Text style={styles.body}>{typeof value === "string" ? value : JSON.stringify(value)}</Text>
                  </View>
                ))}
                {evidence.length === 0 ? (
                  <Text style={styles.muted}>No evidence items were returned.</Text>
                ) : (
                  evidence.map((item) => (
                    <View key={item.id} style={styles.evidence}>
                      <Text style={styles.evidenceType}>{item.evidence_type ?? "evidence"}</Text>
                      <Text style={styles.body}>{item.excerpt ?? "No excerpt supplied."}</Text>
                      {item.source_locator && <Text style={styles.muted}>{item.source_locator}</Text>}
                    </View>
                  ))
                )}

                <Text style={styles.subheading}>Case and non-consequential decision</Text>
                {!selectedCandidate.case ? (
                  <Button label="Open review case" disabled={busy} onPress={() => void openCase()} />
                ) : (
                  <>
                    <Text style={styles.muted}>Case {selectedCandidate.case.id} · {stateLabel(selectedCandidate.case.disposition ?? "open")}</Text>
                    <TextInput value={decisionReason} onChangeText={setDecisionReason} placeholder="Reason for this review decision" placeholderTextColor="#7c7890" style={styles.input} multiline />
                    <View style={styles.decisionRow}>
                      {(["monitor", "investigate", "insufficient_evidence"] as const).map((disposition) => (
                        <Button key={disposition} label={stateLabel(disposition)} disabled={busy} secondary onPress={() => void recordDecision(disposition)} />
                      ))}
                    </View>
                    <Button label="Generate report draft" disabled={busy} onPress={() => void createReport()} />
                  </>
                )}
                {reportDraft?.content && <Text selectable style={styles.report}>{JSON.stringify(reportDraft.content, null, 2)}</Text>}
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Coverage</Text>
              <Text style={styles.muted}>{coverage?.coverage_contract?.notice ?? "Coverage states come from the API."}</Text>
              {(coverage?.connectors ?? []).map((connector) => (
                <View key={String(connector.connector_key)} style={styles.coverageRow}>
                  <View>
                    <Text style={styles.body}>{connector.source ?? connector.connector_key ?? "source"}</Text>
                    <Text style={styles.muted}>{connector.source_mode ?? "unknown mode"}</Text>
                  </View>
                  <Text style={[styles.coverageState, connector.state === "unavailable" && styles.coverageUnavailable]}>{stateLabel(connector.state)}</Text>
                </View>
              ))}
              {!coverage && <Text style={styles.muted}>Select a brand to load coverage.</Text>}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#11101a" },
  container: { padding: 20, paddingBottom: 48, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  eyebrow: { color: "#a89dfd", fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  title: { color: "#f7f5ff", fontSize: 30, fontWeight: "800", marginTop: 5 },
  subtitle: { color: "#aaa6bc", fontSize: 14, marginTop: 4 },
  card: { backgroundColor: "#1b1927", borderColor: "#302b43", borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  warning: { backgroundColor: "#352a17", borderColor: "#8c6726", borderWidth: 1, borderRadius: 12, padding: 14, gap: 5 },
  warningTitle: { color: "#ffd98a", fontWeight: "800", fontSize: 16 },
  warningText: { color: "#ead9b4", lineHeight: 20 },
  outage: { backgroundColor: "#3b2028", borderColor: "#a75363", borderWidth: 1, borderRadius: 12, padding: 14, gap: 5 },
  outageTitle: { color: "#ffb4bf", fontWeight: "800", fontSize: 16 },
  outageInline: { color: "#ff9faf", fontWeight: "700" },
  error: { color: "#ffb4bf", backgroundColor: "#3b2028", borderRadius: 10, padding: 12, lineHeight: 20 },
  sectionTitle: { color: "#f7f5ff", fontSize: 18, fontWeight: "800" },
  subheading: { color: "#d7d2ed", fontSize: 14, fontWeight: "800", marginTop: 8 },
  body: { color: "#e5e1ef", lineHeight: 21 },
  muted: { color: "#aaa6bc", lineHeight: 19 },
  button: { backgroundColor: "#7c5cff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  buttonSecondary: { backgroundColor: "transparent", borderColor: "#625a7e", borderWidth: 1 },
  buttonText: { color: "#fff", fontWeight: "800", textAlign: "center" },
  buttonTextSecondary: { color: "#d8d1ff" },
  disabled: { opacity: 0.45 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderColor: "#514a68", borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 },
  chipSelected: { backgroundColor: "#332b5b", borderColor: "#9d8cff" },
  chipText: { color: "#c6c0d8" },
  chipTextSelected: { color: "#fff" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  queueItem: { borderColor: "#383249", borderWidth: 1, borderRadius: 11, padding: 12, gap: 5 },
  queueItemSelected: { borderColor: "#9d8cff", backgroundColor: "#25203a" },
  queueTitle: { color: "#f2effb", fontWeight: "800", flex: 1 },
  badge: { color: "#c9bcff", backgroundColor: "#332b5b", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 },
  dimension: { backgroundColor: "#232032", borderRadius: 9, padding: 10, gap: 3 },
  dimensionName: { color: "#b7aaff", fontWeight: "800", textTransform: "capitalize" },
  evidence: { borderLeftColor: "#7c5cff", borderLeftWidth: 3, paddingLeft: 10, gap: 3 },
  evidenceType: { color: "#b7aaff", fontWeight: "800", textTransform: "capitalize" },
  input: { minHeight: 72, borderColor: "#514a68", borderWidth: 1, borderRadius: 10, color: "#fff", padding: 11, textAlignVertical: "top" },
  decisionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  report: { backgroundColor: "#100e17", color: "#cfc8e5", borderRadius: 10, padding: 10, fontSize: 11 },
  coverageRow: { borderTopColor: "#383249", borderTopWidth: 1, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  coverageState: { color: "#8de0b5", fontWeight: "800", textTransform: "capitalize" },
  coverageUnavailable: { color: "#ff9faf" },
});
