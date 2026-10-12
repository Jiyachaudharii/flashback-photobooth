import { useCallback, useEffect, useRef, useState } from "react";
import { FILTERS, filterToCss, getFilter } from "./filters";
import { THEMES, getTheme, renderStrip } from "./strip";

type Screen = "landing" | "studio" | "result";
type Facing = "user" | "environment";
type Slots = (string | null)[];

const SHOTS = 4;
const COUNTDOWN = 3;
const emptySlots = (): Slots => Array(SHOTS).fill(null);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------
   Camera: started in exactly ONE place (this effect). It starts when
   the studio mounts, restarts when you flip cameras or retry, and
   always stops the tracks on cleanup, so the camera light turns off
   as soon as you leave the studio.
---------------------------------------------------------------- */
function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access was blocked. Allow the camera for this site in your browser's address bar or settings, then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "We couldn't find a camera on this device.";
    case "NotReadableError":
    case "AbortError":
      return "Your camera is busy. Close other apps or tabs using it (Zoom, FaceTime, another booth tab) and try again.";
    default:
      return "Something went wrong starting the camera. Try again, or use a different browser.";
  }
}

function useCamera(facing: Facing) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "live" | "error">("starting");
  const [error, setError] = useState("");
  const [canFlip, setCanFlip] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    setStatus("starting");
    setError("");

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("Camera needs a secure (https) connection. Open the booth from its https:// link or from localhost.");
        setStatus("error");
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          await video.play().catch(() => undefined);
        }
        setStatus("live");
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (err) {
        if (cancelled) return;
        setError(cameraErrorMessage(err));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [facing, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { videoRef, status, error, canFlip, retry };
}

/** Grabs the current video frame, centre-cropped to 4:3. Stored unfiltered; filters apply at export. */
function grabFrame(video: HTMLVideoElement, mirror: boolean): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const target = 4 / 3;
  let sw = vw, sh = vh;
  if (vw / vh > target) sw = Math.round(vh * target);
  else sh = Math.round(vw / target);
  const sx = Math.round((vw - sw) / 2);
  const sy = Math.round((vh - sh) / 2);

  const outW = Math.min(1200, sw);
  const outH = Math.round(outW / target);
  const c = document.createElement("canvas");
  c.width = outW;
  c.height = outH;
  const ctx = c.getContext("2d")!;
  if (mirror) {
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outW, outH);
  return c.toDataURL("image/jpeg", 0.92);
}

/* ------------------------------- App ------------------------------- */
export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [shots, setShots] = useState<Slots>(emptySlots);
  const [filterId, setFilterId] = useState("film");
  const [themeId, setThemeId] = useState("bubblegum");

  const newStrip = () => {
    setShots(emptySlots());
    setScreen("studio");
  };

  return (
    <div className="app">
      {screen === "landing" && <Landing onStart={newStrip} />}
      {screen === "studio" && (
        <Studio
          shots={shots}
          setShots={setShots}
          filterId={filterId}
          setFilterId={setFilterId}
          onHome={() => setScreen("landing")}
          onDone={() => setScreen("result")}
        />
      )}
      {screen === "result" && (
        <Result
          shots={shots.filter((s): s is string => !!s)}
          filterId={filterId}
          setFilterId={setFilterId}
          themeId={themeId}
          setThemeId={setThemeId}
          onBack={() => setScreen("studio")}
          onNew={newStrip}
        />
      )}
    </div>
  );
}

/* ----------------------------- Landing ----------------------------- */
function Landing({ onStart }: { onStart: () => void }) {
  return (
    <main className="landing">
      <span className="deco s1" aria-hidden>✦</span>
      <span className="deco s2" aria-hidden>✧</span>
      <span className="deco s3" aria-hidden>✦</span>
      <span className="deco s4" aria-hidden>♡</span>

      <section className="landing-copy">
        <p className="eyebrow">est. 2026 · no sign-up · free</p>
        <h1 className="logo">FLASH<br />BACK</h1>
        <p className="tagline">your internet photo booth</p>
        <p className="lede">
          Four shots, a little countdown, a filter that makes everything feel like a disposable camera.
          Walk away with one printable photo strip.
        </p>
        <button className="btn btn-primary btn-big" onClick={onStart}>
          Step inside <span aria-hidden>→</span>
        </button>
        <ul className="badges">
          <li>📸 4-shot countdown</li>
          <li>🎞️ vintage filters</li>
          <li>🔒 photos stay on your device</li>
        </ul>
      </section>

      <div className="mock-strip" aria-hidden>
        {["#ffb3d9", "#c9b8ff", "#a8e6ff", "#ffe08a"].map((c, i) => (
          <div key={c} className="mock-frame" style={{ background: `linear-gradient(135deg, ${c}, #fff6fb)` }}>
            <span>{["☺", "✌", "♡", "✦"][i]}</span>
          </div>
        ))}
        <div className="mock-foot">FLASHBACK</div>
      </div>
    </main>
  );
}

/* ----------------------------- Studio ------------------------------ */
interface StudioProps {
  shots: Slots;
  setShots: React.Dispatch<React.SetStateAction<Slots>>;
  filterId: string;
  setFilterId: (id: string) => void;
  onHome: () => void;
  onDone: () => void;
}

function Studio({ shots, setShots, filterId, setFilterId, onHome, onDone }: StudioProps) {
  const [facing, setFacing] = useState<Facing>("user");
  const { videoRef, status, error, canFlip, retry } = useCamera(facing);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [shooting, setShooting] = useState(false);
  const runId = useRef(0);
  const shotsRef = useRef(shots);
  shotsRef.current = shots;

  // Cancel any countdown in progress if the studio unmounts.
  useEffect(() => () => void runId.current++, []);

  const filled = shots.filter(Boolean).length;
  const complete = filled === SHOTS;
  const mirror = facing === "user";

  const shoot = async () => {
    if (status !== "live" || shooting) return;
    const id = ++runId.current;
    setShooting(true);
    for (let i = 0; i < SHOTS; i++) {
      if (shotsRef.current[i]) continue;
      for (let n = COUNTDOWN; n > 0; n--) {
        setCount(n);
        await sleep(1000);
        if (runId.current !== id) return;
      }
      setCount(null);
      const frame = videoRef.current ? grabFrame(videoRef.current, mirror) : null;
      if (frame) {
        setFlash(true);
        setShots((prev) => prev.map((s, j) => (j === i ? frame : s)));
        await sleep(180);
        setFlash(false);
        await sleep(650);
        if (runId.current !== id) return;
      }
    }
    setShooting(false);
  };

  const stop = () => {
    runId.current++;
    setCount(null);
    setShooting(false);
  };

  const retake = (i: number) => {
    if (shooting) return;
    setShots((prev) => prev.map((s, j) => (j === i ? null : s)));
  };

  const filterCss = filterToCss(getFilter(filterId));

  return (
    <main className="studio">
      <header className="topbar">
        <button className="btn btn-ghost" onClick={() => { stop(); onHome(); }}>← Home</button>
        <span className="logo-sm">FLASHBACK</span>
        <span className="counter">{filled}/{SHOTS}</span>
      </header>

      <div className="studio-grid">
        <section className="viewfinder-wrap">
          <div className="viewfinder">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={mirror ? "mirror" : ""}
              style={{ filter: filterCss }}
            />
            {status === "starting" && <div className="vf-msg">Warming up the camera… <small>Allow camera access when your browser asks.</small></div>}
            {status === "error" && (
              <div className="vf-msg vf-error" role="alert">
                <strong>Camera unavailable</strong>
                <span>{error}</span>
                <button className="btn btn-primary" onClick={retry}>Try again</button>
              </div>
            )}
            {count !== null && <div className="countdown" key={count} aria-live="assertive">{count}</div>}
            {flash && <div className="flash" />}
            <div className="vf-corners" aria-hidden />
            {shooting && <div className="rec" aria-hidden>● shot {Math.min(filled + 1, SHOTS)} of {SHOTS}</div>}
          </div>

          <div className="filters" role="radiogroup" aria-label="Filter">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="radio"
                aria-checked={filterId === f.id}
                className={`chip ${filterId === f.id ? "on" : ""}`}
                onClick={() => setFilterId(f.id)}
              >
                <i style={{ background: f.swatch }} />
                {f.label}
              </button>
            ))}
          </div>

          <div className="controls">
            {canFlip && (
              <button className="btn btn-ghost" disabled={shooting} onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}>
                ⟲ Flip
              </button>
            )}
            {complete ? (
              <button className="btn btn-primary btn-big" onClick={onDone}>Develop my strip ✦</button>
            ) : shooting ? (
              <button className="btn btn-ghost btn-big" onClick={stop}>Pause</button>
            ) : (
              <button className="btn btn-primary btn-big shutter" disabled={status !== "live"} onClick={shoot}>
                {filled === 0 ? "Start the booth" : `Shoot ${SHOTS - filled} more`}
              </button>
            )}
          </div>
        </section>

        <aside className="slots" aria-label="Your shots">
          <p className="slots-title">your strip <small>tap a shot to retake</small></p>
          <div className="slot-list">
            {shots.map((s, i) => (
              <button
                key={i}
                className={`slot ${s ? "filled" : ""}`}
                onClick={() => s && retake(i)}
                disabled={!s || shooting}
                aria-label={s ? `Retake shot ${i + 1}` : `Shot ${i + 1}, empty`}
              >
                {s ? <img src={s} alt="" style={{ filter: filterCss }} /> : <span>{i + 1}</span>}
                {s && !shooting && <em>retake</em>}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

/* ----------------------------- Result ------------------------------ */
interface ResultProps {
  shots: string[];
  filterId: string;
  setFilterId: (id: string) => void;
  themeId: string;
  setThemeId: (id: string) => void;
  onBack: () => void;
  onNew: () => void;
}

function Result({ shots, filterId, setFilterId, themeId, setThemeId, onBack, onNew }: ResultProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    setReady(false);
    if (canvasRef.current && shots.length === SHOTS) {
      renderStrip(canvasRef.current, shots, getFilter(filterId), getTheme(themeId)).then(() => alive && setReady(true));
    }
    return () => {
      alive = false;
    };
  }, [shots, filterId, themeId]);

  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob(resolve, "image/png");
    });

  const fileName = `flashback-${new Date().toISOString().slice(0, 10)}.png`;

  const download = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setSaved(true);
  };

  const canShare = typeof navigator !== "undefined" && "canShare" in navigator;
  const share = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "My FLASHBACK strip" });
        setSaved(true);
      } catch {
        /* user closed the share sheet */
      }
    } else {
      download();
    }
  };

  return (
    <main className="result">
      <header className="topbar">
        <button className="btn btn-ghost" onClick={onBack}>← Studio</button>
        <span className="logo-sm">FLASHBACK</span>
        <span className="counter">✦</span>
      </header>

      <div className="result-grid">
        <div className={`strip-stage ${ready ? "ready" : ""}`}>
          <canvas ref={canvasRef} className="strip-canvas" aria-label="Your finished photo strip" />
          {!ready && <div className="developing">developing…</div>}
        </div>

        <section className="result-panel">
          <h2>Fresh out of the booth ✦</h2>
          <p className="muted">Pick a filter and a paper, then save it. Nothing was uploaded anywhere: this strip only exists on your device.</p>

          <p className="label">Filter</p>
          <div className="filters wrap">
            {FILTERS.map((f) => (
              <button key={f.id} className={`chip ${filterId === f.id ? "on" : ""}`} onClick={() => setFilterId(f.id)} aria-pressed={filterId === f.id}>
                <i style={{ background: f.swatch }} />
                {f.label}
              </button>
            ))}
          </div>

          <p className="label">Paper</p>
          <div className="filters wrap">
            {THEMES.map((t) => (
              <button key={t.id} className={`chip ${themeId === t.id ? "on" : ""}`} onClick={() => setThemeId(t.id)} aria-pressed={themeId === t.id}>
                <i style={{ background: Array.isArray(t.paper) ? `linear-gradient(${t.paper[0]}, ${t.paper[1]})` : t.paper }} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="result-actions">
            <button className="btn btn-primary btn-big" disabled={!ready} onClick={download}>Download PNG ↓</button>
            {canShare && <button className="btn btn-ghost btn-big" disabled={!ready} onClick={share}>Share…</button>}
          </div>
          {saved && <p className="saved">Saved! ♡ Check your downloads or photos.</p>}
          <button className="btn btn-link" onClick={onNew}>Take another strip</button>
        </section>
      </div>
    </main>
  );
}
