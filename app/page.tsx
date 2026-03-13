"use client";

import { useEffect, useState, useCallback } from "react";

type LogEntry = { time: string; message: string; type: "info" | "success" | "error" };
type SwVersion = "v1" | "v2" | "v3";
type SubInfo = { id: string; createdAt: string; swVersion: SwVersion };

type IOSNavigator = Navigator & { standalone?: boolean };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const SW_VERSIONS: SwVersion[] = ["v1", "v2", "v3"];

const VERSION_LABELS: Record<SwVersion, string> = {
  v1: "v1 – Flat",
  v2: "v2 – Structured",
  v3: "v3 – Rich",
};

const VERSION_DESCRIPTIONS: Record<SwVersion, string> = {
  v1: '{ title, body, icon, url }',
  v2: '{ version:2, notification:{title,body,tag}, meta:{icon,url} }',
  v3: '{ version:3, notification:{title,body,image}, actions:[…], meta:{vibrate,…} }',
};

const VERSION_COLORS: Record<SwVersion, string> = {
  v1: "bg-gray-700 text-gray-300",
  v2: "bg-blue-900/60 text-blue-300",
  v3: "bg-purple-900/60 text-purple-300",
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** Ask the active SW for its version via MessageChannel. */
async function querySwVersion(): Promise<SwVersion> {
  return new Promise((resolve) => {
    const ctrl = navigator.serviceWorker.controller;
    if (!ctrl) { resolve("v1"); return; }
    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => resolve((e.data?.version as SwVersion) || "v1");
    ctrl.postMessage({ type: "GET_SW_VERSION" }, [channel.port2]);
    setTimeout(() => resolve("v1"), 800);
  });
}

export default function Home() {
  const [swReady, setSwReady] = useState(false);
  const [swVersion, setSwVersion] = useState<SwVersion>("v1");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [mySubId, setMySubId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [title, setTitle] = useState("Hello from Web Push!");
  const [body, setBody] = useState("This is a demo notification 🔔");
  const [image, setImage] = useState("");
  const [sending, setSending] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showIOSInstallBanner, setShowIOSInstallBanner] = useState(false);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, message, type }, ...prev].slice(0, 50));
  }, []);

  const fetchSubscriptions = useCallback(async () => {
    const res = await fetch("/api/subscriptions");
    const data = await res.json();
    setSubscriptions(data.subscriptions ?? []);
  }, []);

  // ── SW registration + version query ────────────────────────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      addLog("Web Push is not supported in this browser.", "error");
      return;
    }
    setPermission(Notification.permission);

    navigator.serviceWorker
      .register("/sw.js", { type: "module" })
      .then(async (reg) => {
        addLog(`Service worker registered (scope: ${reg.scope})`, "success");
        setSwReady(true);

        // Query the active SW for its declared version
        const activeWorker = reg.active;
        if (activeWorker) {
          const channel = new MessageChannel();
          channel.port1.onmessage = (e) => {
            if (e.data?.type === "SW_VERSION") setSwVersion(e.data.version as SwVersion);
          };
          activeWorker.postMessage({ type: "GET_SW_VERSION" }, [channel.port2]);
        }

        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        if (sub) {
          addLog("Existing subscription found.", "info");
          setSubscribed(true);
        }
      })
      .catch((err) => addLog(`SW registration failed: ${err}`, "error"));

    fetchSubscriptions();
  }, [addLog, fetchSubscriptions]);

  // ── SW message listener (SW_ACTIVATED / SW_VERSION) ───────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      const { type, version } = event.data ?? {};

      if (type === "SW_VERSION") {
        setSwVersion(version as SwVersion);
      }

      if (type === "SW_ACTIVATED") {
        // SW itself already called PATCH /api/sw-version; just refresh the UI.
        setSwVersion(version as SwVersion);
        addLog(`⚙️ SW activated — version: ${version} (server synced by SW)`, "info");
        fetchSubscriptions();
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [addLog, fetchSubscriptions]);

  // ── Install prompt ─────────────────────────────────────────────────────────
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as IOSNavigator).standalone === true;

    setIsStandalone(standalone);
    if (standalone) { setCanInstall(false); return; }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setCanInstall(true);
      addLog("Install prompt is ready.", "info");
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setCanInstall(false);
      setIsStandalone(true);
      setShowIOSInstallBanner(false);
      addLog("App installed.", "success");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [addLog]);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone =
      (window.navigator as IOSNavigator).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    setShowIOSInstallBanner(isIOS && !standalone);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function subscribe() {
    if (!swReady) return;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") { addLog("Permission denied.", "error"); return; }

      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // Read SW version just before subscribing
      const currentVersion = await querySwVersion();
      setSwVersion(currentVersion);

      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sub.toJSON(), swVersion: currentVersion }),
      });

      if (res.ok) {
        const data = await res.json();
        addLog(`Subscribed! SW version registered: ${data.swVersion}`, "success");
        setSubscribed(true);
        setMySubId(data.id);
        fetchSubscriptions();
      } else {
        const err = await res.json();
        addLog(`Subscribe failed: ${err.error}`, "error");
      }
    } catch (err) {
      addLog(`Subscribe error: ${err}`, "error");
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { addLog("No active subscription.", "error"); return; }

      await fetch("/api/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });

      await sub.unsubscribe();
      addLog("Unsubscribed successfully.", "info");
      setSubscribed(false);
      setMySubId(null);
      fetchSubscriptions();
    } catch (err) {
      addLog(`Unsubscribe error: ${err}`, "error");
    }
  }

  async function sendNotification() {
    setSending(true);
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, image: image || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        const breakdown = data.versionBreakdown
          ? Object.entries(data.versionBreakdown)
              .map(([v, n]) => `${v}×${n}`)
              .join(", ")
          : "";
        addLog(
          `Sent ${data.sent}/${data.total} (${breakdown}). Failed: ${data.failed}`,
          "success"
        );
      } else {
        addLog(`Send failed: ${data.error}`, "error");
      }
    } catch (err) {
      addLog(`Send error: ${err}`, "error");
    } finally {
      setSending(false);
    }
  }

  async function updateSubVersion(id: string, newVersion: SwVersion) {
    const res = await fetch("/api/sw-version", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, version: newVersion }),
    });
    if (res.ok) {
      addLog(`Subscription ${id} → ${newVersion}`, "success");
      fetchSubscriptions();
    } else {
      const data = await res.json();
      addLog(`Version update failed: ${data.error}`, "error");
    }
  }

  async function installApp() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      addLog(`Install prompt result: ${outcome}`, outcome === "accepted" ? "success" : "info");
    } catch (err) {
      addLog(`Install prompt failed: ${err}`, "error");
    } finally {
      setDeferredPrompt(null);
      setCanInstall(false);
      setInstalling(false);
    }
  }

  const logColor = (type: LogEntry["type"]) => {
    if (type === "success") return "text-green-400";
    if (type === "error") return "text-red-400";
    return "text-gray-300";
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 pb-28">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-1">🔔 Web Push Demo</h1>
          <p className="text-gray-400 text-sm">Next.js · VAPID · SW Versioning · In-memory</p>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Badge label="Service Worker" ok={swReady} />
          <Badge label="SW Version" ok={swReady} text={swVersion} />
          <Badge label="Permission" ok={permission === "granted"} text={permission} />
          <Badge label="Subscribed" ok={subscribed} />
          <Badge label="Subscribers" ok={subscriptions.length > 0} text={String(subscriptions.length)} />
          <Badge
            label="Install"
            ok={canInstall || isStandalone}
            text={isStandalone ? "installed" : canInstall ? "ready" : "not ready"}
          />
        </div>

        {/* SW Version Info */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-semibold">⚙️ SW Version Info</h2>
          <p className="text-sm text-gray-400">
            The active service worker declares <span className="font-mono text-white">SW_VERSION</span> in{" "}
            <span className="font-mono text-indigo-400">public/sw.js</span>. Change it there to simulate
            a client upgrade — the page will auto-sync the new version to the server on activation.
          </p>
          <div className="space-y-2">
            {SW_VERSIONS.map((v) => (
              <div
                key={v}
                className={`flex items-start gap-3 rounded-xl px-4 py-3 ${
                  v === swVersion ? "ring-1 ring-indigo-500 bg-gray-800" : "bg-gray-800/50"
                }`}
              >
                <span
                  className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${VERSION_COLORS[v]}`}
                >
                  {v}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">
                    {v === "v1" ? "Flat (Legacy)" : v === "v2" ? "Structured" : "Rich (Actions + Image)"}
                    {v === swVersion && (
                      <span className="ml-2 text-xs text-indigo-400">(active SW)</span>
                    )}
                  </p>
                  <p className="font-mono text-xs text-gray-400 mt-0.5">{VERSION_DESCRIPTIONS[v]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-semibold">Subscription</h2>
          <p className="text-sm text-gray-400">
            Subscribe this browser. The current SW version{" "}
            <span className={`font-mono font-bold ${VERSION_COLORS[swVersion]} px-1.5 py-0.5 rounded`}>
              {swVersion}
            </span>{" "}
            will be stored server-side to build the matching payload.
          </p>
          <div className="flex gap-3">
            <button
              onClick={subscribe}
              disabled={subscribed || !swReady}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl py-2 font-medium transition"
            >
              Subscribe
            </button>
            <button
              onClick={unsubscribe}
              disabled={!subscribed}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl py-2 font-medium transition"
            >
              Unsubscribe
            </button>
          </div>
        </div>

        {/* Send Notification */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-semibold">Send Notification</h2>
          <p className="text-sm text-gray-400">
            Each subscriber receives a payload built for their stored version.
            {subscriptions.length > 0 && (
              <span className="ml-1">
                (
                {SW_VERSIONS.filter((v) => subscriptions.some((s) => s.swVersion === v)).map(
                  (v, i, arr) => (
                    <span key={v}>
                      <span className={`font-mono font-semibold ${VERSION_COLORS[v]} px-1 rounded`}>{v}</span>
                      ×{subscriptions.filter((s) => s.swVersion === v).length}
                      {i < arr.length - 1 ? ", " : ""}
                    </span>
                  )
                )}
                )
              </span>
            )}
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
            className="w-full bg-gray-800 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notification body"
            rows={2}
            className="w-full bg-gray-800 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="Image URL (optional — used by v3 Rich payload)"
            className="w-full bg-gray-800 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-gray-400"
          />
          <button
            onClick={sendNotification}
            disabled={sending || subscriptions.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl py-2 font-medium transition"
          >
            {sending ? "Sending…" : `Send to ${subscriptions.length} subscriber(s)`}
          </button>
        </div>

        {/* Install App */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-semibold">Install App</h2>
          <p className="text-sm text-gray-400">
            On Android/Desktop, this uses the browser install prompt when available.
          </p>
          <button
            onClick={installApp}
            disabled={!canInstall || installing || isStandalone}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl py-2 font-medium transition"
          >
            {isStandalone ? "Already installed" : installing ? "Opening prompt…" : "Install app"}
          </button>
        </div>

        {/* Active Subscribers */}
        {subscriptions.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
            <h2 className="text-lg font-semibold">Active Subscribers</h2>
            <p className="text-xs text-gray-500">
              Change a subscription&apos;s version to test different payload formats without reloading the SW.
            </p>
            <div className="space-y-2">
              {subscriptions.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between text-sm rounded-xl px-3 py-2.5 ${
                    s.id === mySubId ? "bg-indigo-950/60 ring-1 ring-indigo-600" : "bg-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-indigo-400 truncate">{s.id}</span>
                    {s.id === mySubId && (
                      <span className="shrink-0 text-xs text-indigo-400 opacity-70">(this device)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <select
                      value={s.swVersion}
                      onChange={(e) => updateSubVersion(s.id, e.target.value as SwVersion)}
                      className={`text-xs rounded-lg px-2 py-1 border border-gray-600 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${VERSION_COLORS[s.swVersion]} bg-gray-700`}
                    >
                      {SW_VERSIONS.map((v) => (
                        <option key={v} value={v}>{VERSION_LABELS[v]}</option>
                      ))}
                    </select>
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Log */}
        <div className="bg-gray-900 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Activity Log</h2>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-gray-500 hover:text-gray-300 transition"
            >
              Clear
            </button>
          </div>
          <div className="font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-600">No activity yet.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={logColor(log.type)}>
                  <span className="text-gray-600">{log.time}</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* iOS install banner */}
      {showIOSInstallBanner && (
        <div className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-indigo-500/30 bg-gray-900/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-indigo-300">Install on iOS</p>
              <p className="text-sm text-gray-200">To receive notifications, add this page to Home Screen.</p>
              <p className="text-xs text-gray-400">
                Press <strong>Share</strong> → <strong>Add to Home Screen</strong>
              </p>
            </div>
            <button
              onClick={() => setShowIOSInstallBanner(false)}
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Badge({ label, ok, text }: { label: string; ok: boolean; text?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
        ok ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-400"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-400" : "bg-gray-500"}`} />
      {label}
      {text !== undefined && <span className="opacity-70">· {text}</span>}
    </span>
  );
}
