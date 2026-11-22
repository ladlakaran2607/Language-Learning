import { useEffect, useState } from "react";
import { useStore } from "./store";
import Chat from "./views/Chat";
import Home from "./views/Home";
import Lessons from "./views/Lessons";
import Read from "./views/Read";
import Review from "./views/Review";
import SettingsView from "./views/Settings";
import Write from "./views/Write";

export type Route = "home" | "chat" | "review" | "lessons" | "write" | "read" | "settings";

const NAV: { route: Route; label: string; icon: string }[] = [
  { route: "home", label: "Home", icon: "⌂" },
  { route: "chat", label: "Chat", icon: "💬" },
  { route: "review", label: "Words", icon: "🃏" },
  { route: "lessons", label: "Lessons", icon: "📘" },
  { route: "write", label: "Write", icon: "✍️" },
  { route: "read", label: "Read", icon: "📖" },
];

function parseHash(): { route: Route; param: string } {
  const [, route = "home", param = ""] = window.location.hash.split("/");
  const valid = [...NAV.map((n) => n.route), "settings"] as string[];
  return { route: (valid.includes(route) ? route : "home") as Route, param: decodeURIComponent(param) };
}

export function go(route: Route, param = "") {
  window.location.hash = `/${route}${param ? "/" + encodeURIComponent(param) : ""}`;
}

export default function App() {
  const [{ route, param }, setLoc] = useState(parseHash);
  const { syncStatus } = useStore();

  useEffect(() => {
    const onHash = () => {
      setLoc(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const syncLabel = { off: "", idle: "", syncing: "Syncing…", ok: "Synced", error: "Sync error" }[syncStatus];

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/home">
          <img src="./icon.svg" alt="" width={28} height={28} />
          <span>Deutsch</span>
        </a>
        <nav className="sidenav" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.route} href={`#/${n.route}`} className={route === n.route ? "active" : ""}>
              <span aria-hidden>{n.icon}</span> {n.label}
            </a>
          ))}
        </nav>
        <div className="topbar-right">
          {syncLabel && <span className={`sync sync-${syncStatus}`}>{syncLabel}</span>}
          <a href="#/settings" className={`gear ${route === "settings" ? "active" : ""}`} aria-label="Settings">
            ⚙︎
          </a>
        </div>
      </header>

      <main className="content">
        {route === "home" && <Home />}
        {route === "chat" && <Chat param={param} />}
        {route === "review" && <Review />}
        {route === "lessons" && <Lessons />}
        {route === "write" && <Write />}
        {route === "read" && <Read />}
        {route === "settings" && <SettingsView />}
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.route} href={`#/${n.route}`} className={route === n.route ? "active" : ""}>
            <span className="tab-icon" aria-hidden>
              {n.icon}
            </span>
            <span className="tab-label">{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
