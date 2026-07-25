import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

function showOfflineReady() {
  if (document.getElementById("offline-ready-notice")) return;

  const notice = document.createElement("div");
  notice.id = "offline-ready-notice";
  notice.className = "offline-ready-notice";
  notice.setAttribute("role", "status");
  notice.textContent = "已保存到本机，断网也能打开";
  document.body.appendChild(notice);

  window.setTimeout(() => notice.classList.add("is-visible"), 50);
  window.setTimeout(() => {
    notice.classList.remove("is-visible");
    window.setTimeout(() => notice.remove(), 300);
  }, 4200);
}

async function enableOfflineAccess() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const base = import.meta.env.BASE_URL;
    await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
    await navigator.serviceWorker.ready;
    showOfflineReady();
  } catch (error) {
    console.warn("Offline access could not be enabled.", error);
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

window.addEventListener("load", () => {
  void enableOfflineAccess();
});
