"use client";

import { useEffect, useState, useCallback } from "react";

type LogEntry = { time: string; message: string; type: "info" | "success" | "error" };
type SubInfo = { id: string; createdAt: string };

type IOSNavigator = Navigator & { standalone?: boolean };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function Home() {
  const [swReady, setSwReady] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [title, setTitle] = useState("Hello from Web Push!");
  const [body, setBody] = useState("This is a demo notification 🔔");
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

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      addLog("Web Push is not supported in this browser.", "error");
      return;
    }
    setPermission(Notification.permission);

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        addLog(`Service worker registered (scope: ${reg.scope})`, "success");
        setSwReady(true);
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

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as IOSNavigator).standalone === true;

    setIsStandalone(standalone);
    if (standalone) {
      setCanInstall(false);
      return;
    }

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

  async function subscribe() {
    if (!swReady) return;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        addLog("Permission denied.", "error");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      if (res.ok) {
        addLog("Subscribed successfully!", "success");
        setSubscribed(true);
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
      if (!sub) {
        addLog("No active subscription.", "error");
        return;
      }

      await fetch("/api/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });

      await sub.unsubscribe();
      addLog("Unsubscribed successfully.", "info");
      setSubscribed(false);
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
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`Sent to ${data.sent}/${data.total} subscriber(s). Failed: ${data.failed}`, "success");
      } else {
        addLog(`Send failed: ${data.error}`, "error");
      }
    } catch (err) {
      addLog(`Send error: ${err}`, "error");
    } finally {
      setSending(false);
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
          <p className="text-gray-400 text-sm">Next.js · VAPID · In-memory subscriptions</p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <Badge label="Service Worker" ok={swReady} />
          <Badge label="Permission" ok={permission === "granted"} text={permission} />
          <Badge label="Subscribed" ok={subscribed} />
          <Badge label="Subscribers" ok={subscriptions.length > 0} text={String(subscriptions.length)} />
          <Badge
            label="Install"
            ok={canInstall || isStandalone}
            text={isStandalone ? "installed" : canInstall ? "ready" : "not ready"}
          />
        </div>

        <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-semibold">Subscription</h2>
          <p className="text-sm text-gray-400">
            Subscribe this browser to receive push notifications from the server.
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

        <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-semibold">Send Notification</h2>
          <p className="text-sm text-gray-400">
            Broadcast a push notification to all active subscribers.
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
          <button
            onClick={sendNotification}
            disabled={sending || subscriptions.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl py-2 font-medium transition"
          >
            {sending ? "Sending…" : `Send to ${subscriptions.length} subscriber(s)`}
          </button>
        </div>

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

        {subscriptions.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-5 space-y-2">
            <h2 className="text-lg font-semibold">Active Subscribers</h2>
            <div className="space-y-1">
              {subscriptions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-sm bg-gray-800 rounded-lg px-3 py-2"
                >
                  <span className="font-mono text-indigo-400">{s.id}</span>
                  <span className="text-gray-500 text-xs">
                    {new Date(s.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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

      {showIOSInstallBanner && (
        <div className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-indigo-500/30 bg-gray-900/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-indigo-300">Install on IOS</p>
              <p className="text-sm text-gray-200">To get notification, please add page to Home Screen</p>
              <p className="text-xs text-gray-400">
                Press <strong>Share</strong> -&gt; <strong>Add to Home Screen</strong>
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
