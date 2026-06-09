/* ===== Shared UI components ===== */
const { useState, useEffect, useRef, useMemo } = React;

/* Faux QR code — deterministic pattern from a seed string */
function qrCells(value, N = 25) {
  let h = 0; for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  const rng = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
  const grid = Array.from({ length: N }, () => Array.from({ length: N }, () => rng() > 0.5));
  const finder = (r, c) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
      const border = i === 0 || i === 6 || j === 0 || j === 6;
      const inner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      const edge = i === -1 || i === 7 || j === -1 || j === 7;
      grid[rr][cc] = edge ? false : (border || inner);
    }
  };
  finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
  return grid;
}
window.qrCells = qrCells;

/* QR as an SVG markup string (for print windows) */
function qrSVGString(value, size, fg = "#16242e", bg = "#ffffff") {
  const N = 25, cells = qrCells(value, N), cs = size / N;
  let rects = "";
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (cells[r][c]) rects += `<rect x="${(c*cs).toFixed(2)}" y="${(r*cs).toFixed(2)}" width="${(cs+0.5).toFixed(2)}" height="${(cs+0.5).toFixed(2)}" fill="${fg}"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bg}"/>${rects}</svg>`;
}
window.qrSVGString = qrSVGString;

/* Draw a QR onto a canvas context at (ox,oy) with given pixel size */
function drawQR(ctx, value, ox, oy, size, fg = "#16242e") {
  const N = 25, cells = qrCells(value, N), cs = size / N;
  ctx.fillStyle = fg;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (cells[r][c]) ctx.fillRect(ox + c * cs, oy + r * cs, cs + 0.6, cs + 0.6);
}
window.drawQR = drawQR;

function QR({ value = "NHP", size = 120, fg = "#16242e", bg = "#ffffff" }) {
  const cells = useMemo(() => qrCells(value, 25), [value]);
  const N = 25, cs = size / N;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", borderRadius: 6 }}>
      <rect width={size} height={size} fill={bg} />
      {cells.map((row, r) => row.map((on, c) => on ? (
        <rect key={r + "-" + c} x={c * cs} y={r * cs} width={cs + 0.5} height={cs + 0.5} fill={fg} />
      ) : null))}
    </svg>
  );
}
window.QR = QR;

/* Donut chart — animated sweep-in, hover highlight */
function Donut({ data, size = 184, thickness = 26, center }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2 - 4;   // leave room for the drop shadow
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const gap = 0.018 * circ;
  const [anim, setAnim] = useState(false);
  const [hover, setHover] = useState(-1);
  const uid = useRef("dn" + Math.random().toString(36).slice(2, 7)).current;
  useEffect(() => { const t = setTimeout(() => setAnim(true), 60); return () => clearTimeout(t); }, []);
  // shade a hex/var color: we layer gradients per segment instead
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          {data.map((d, i) => (
            <linearGradient key={i} id={`${uid}-g${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={d.color} stopOpacity="1" />
              <stop offset="55%" stopColor={d.color} stopOpacity="0.92" />
              <stop offset="100%" stopColor={d.color} stopOpacity="0.66" />
            </linearGradient>
          ))}
          {/* outer drop shadow for the whole ring → 3D lift */}
          <filter id={`${uid}-lift`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0b1f3a" floodOpacity="0.28" />
          </filter>
          {/* inner shadow to carve the track */}
          <filter id={`${uid}-inset`} x="-30%" y="-30%" width="160%" height="160%">
            <feOffset dx="0" dy="2" /><feGaussianBlur stdDeviation="2.5" result="o" />
            <feComposite in="SourceGraphic" in2="o" operator="out" result="inv" />
            <feColorMatrix in="inv" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.4 0" />
          </filter>
          {/* radial sheen overlay */}
          <radialGradient id={`${uid}-sheen`} cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="42%" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {/* recessed track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} opacity="0.85" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#000" strokeWidth={thickness} opacity="0.05" filter={`url(#${uid}-inset)`} />

          <g filter={`url(#${uid}-lift)`}>
            {data.map((d, i) => {
              const frac = d.value / total;
              const len = Math.max(0, frac * circ - gap);
              const dash = anim ? len : 0;
              const isHover = hover === i;
              const el = (
                <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${uid}-g${i})`}
                  strokeWidth={isHover ? thickness + 6 : thickness}
                  strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} strokeLinecap="round"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}
                  style={{ transition: `stroke-dasharray .95s cubic-bezier(.2,.85,.25,1) ${i * 0.08}s, stroke-width .2s`, cursor: "pointer", filter: isHover ? `drop-shadow(0 0 9px ${d.color})` : "none" }} />
              );
              offset += frac * circ;
              return el;
            })}
          </g>

          {/* glossy top highlight arcs riding each segment */}
          <g style={{ pointerEvents: "none" }}>
            {(() => { let o2 = 0; return data.map((d, i) => {
              const frac = d.value / total;
              const len = Math.max(0, frac * circ - gap);
              const dash = anim ? len : 0;
              const seg = (
                <circle key={i} cx={cx} cy={cy} r={r + thickness / 2 - 5} fill="none" stroke="#fff" strokeOpacity="0.4"
                  strokeWidth={3} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-o2} strokeLinecap="round"
                  style={{ transition: `stroke-dasharray .95s cubic-bezier(.2,.85,.25,1) ${i * 0.08}s` }} />
              );
              o2 += frac * circ; return seg;
            }); })()}
          </g>
        </g>

        {/* soft sheen over the whole dial */}
        <circle cx={cx} cy={cy} r={size / 2 - 2} fill={`url(#${uid}-sheen)`} style={{ pointerEvents: "none" }} />
      </svg>
      {center && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
          {hover >= 0 ? (
            <div style={{ transition: "all .15s" }}>
              <div className="num" style={{ fontSize: 30, fontWeight: 800, color: data[hover].color, textShadow: `0 2px 8px ${data[hover].color}55` }}>{data[hover].value}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>{data[hover].label}</div>
            </div>
          ) : center}
        </div>
      )}
    </div>
  );
}
window.Donut = Donut;

/* smooth catmull-rom → bezier path */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/* Modern animated bar + smooth-area chart with hover tooltip */
function BarLineChart({ labels, series, height = 240, id = "blc" }) {
  const max = Math.max(...series.flatMap(s => s.data), 1);
  const niceMax = Math.ceil(max / 10) * 10;
  const W = 760, H = height, padL = 38, padR = 16, padT = 22, padB = 32;
  const innerW = W - padL - padR, innerH = H - padB - padT;
  const colW = innerW / labels.length;
  const x = (i) => padL + (i + 0.5) * colW;
  const y = (v) => padT + innerH - (v / niceMax) * innerH;
  const bw = colW * 0.4;
  const ticks = 4;
  const [anim, setAnim] = useState(false);
  const [hover, setHover] = useState(-1);
  useEffect(() => { const t = setTimeout(() => setAnim(true), 60); return () => clearTimeout(t); }, []);

  const linePts = series[1] ? series[1].data.map((v, i) => [x(i), y(v)]) : [];
  const linePath = smoothPath(linePts);
  const areaPath = linePath ? linePath + ` L ${x(labels.length - 1)} ${padT + innerH} L ${x(0)} ${padT + innerH} Z` : "";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }} onMouseLeave={() => setHover(-1)}>
      <defs>
        <linearGradient id={id + "-bar"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={id + "-bar-h"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={id + "-area"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <filter id={id + "-glow"} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* gridlines */}
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = (niceMax / ticks) * i;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 4"} opacity={i === 0 ? 1 : 0.6} />
            <text x={padL - 9} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-3)" className="num">{Math.round(v)}</text>
          </g>
        );
      })}

      {/* hover column highlight + vertical guide */}
      {hover >= 0 && <rect x={padL + hover * colW} y={padT} width={colW} height={innerH} fill="var(--primary)" opacity="0.06" rx="6" />}
      {hover >= 0 && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + innerH} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.55" />}

      {/* bars (borrow) */}
      {series[0] && series[0].data.map((v, i) => {
        const fullH = innerH - (y(v) - padT);
        const h = anim ? fullH : 0;
        return (
          <rect key={i} x={x(i) - bw / 2} y={padT + innerH - h} width={bw} height={h}
            rx="5" fill={hover === i ? `url(#${id}-bar-h)` : `url(#${id}-bar)`} filter={hover === i ? `url(#${id}-glow)` : undefined}
            style={{ transition: `y .8s cubic-bezier(.2,.8,.2,1) ${i * 35}ms, height .8s cubic-bezier(.2,.8,.2,1) ${i * 35}ms, fill .2s` }} />
        );
      })}

      {/* area + line (return) */}
      {series[1] && <path d={areaPath} fill={`url(#${id}-area)`} opacity={anim ? 1 : 0} style={{ transition: "opacity 1s ease .4s" }} />}
      {series[1] && (
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          pathLength="1" strokeDasharray="1" strokeDashoffset={anim ? 0 : 1} filter={`url(#${id}-glow)`}
          style={{ transition: "stroke-dashoffset 1.1s ease .2s" }} />
      )}
      {series[1] && series[1].data.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 6 : 3.5} fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5"
          filter={hover === i ? `url(#${id}-glow)` : undefined}
          opacity={anim ? 1 : 0} style={{ transition: "opacity .5s ease " + (0.6 + i * 0.03) + "s, r .15s" }} />
      ))}

      {/* labels */}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fontWeight={hover === i ? 700 : 400} fill={hover === i ? "var(--text)" : "var(--text-3)"}>{l}</text>
      ))}

      {/* hover hit areas + tooltip */}
      {labels.map((l, i) => (
        <rect key={i} x={padL + i * colW} y={padT} width={colW} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
      ))}
      {hover >= 0 && (() => {
        const tw = 96, th = series[1] ? 52 : 34;
        const tx = Math.min(Math.max(x(hover) - tw / 2, padL), W - padR - tw);
        const ty = padT + 4;
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={tx} y={ty} width={tw} height={th} rx="9" fill="var(--text)" opacity="0.92" />
            <text x={tx + 10} y={ty + 17} fontSize="10.5" fill="var(--bg)" opacity="0.8">{labels[hover]}</text>
            <circle cx={tx + 12} cy={ty + 31} r="3.5" fill="var(--primary)" />
            <text x={tx + 21} y={ty + 34.5} fontSize="11" fill="var(--bg)" className="num">ยืม {series[0].data[hover]}</text>
            {series[1] && <><circle cx={tx + 12} cy={ty + 45} r="3.5" fill="var(--accent)" />
              <text x={tx + 21} y={ty + 48.5} fontSize="11" fill="var(--bg)" className="num">คืน {series[1].data[hover]}</text></>}
          </g>
        );
      })()}
    </svg>
  );
}
window.BarLineChart = BarLineChart;

/* Horizontal bars — animated width */
function HBars({ data, color = "var(--primary)" }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const [anim, setAnim] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnim(true), 60); return () => clearTimeout(t); }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
            <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{d.label}</span>
            <span className="num" style={{ fontWeight: 700 }}>{d.value}</span>
          </div>
          <div className="progress"><span style={{ width: (anim ? d.value / max * 100 : 0) + "%", background: d.color || color, transition: `width .9s cubic-bezier(.2,.8,.2,1) ${i * 70}ms` }}></span></div>
        </div>
      ))}
    </div>
  );
}
window.HBars = HBars;

/* Modal */
function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" style={wide ? { width: 760 } : {}} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
window.Modal = Modal;

/* Drawer */
function Drawer({ title, onClose, children, footer }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={e => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </div>
  );
}
window.Drawer = Drawer;

/* Badge */
function Badge({ cls, children, dot }) {
  return <span className={"badge " + cls}>{dot && <span className="bdot"></span>}{children}</span>;
}
window.Badge = Badge;

/* Toast context */
const ToastCtx = React.createContext(() => {});
window.ToastCtx = ToastCtx;
function ToastHost({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (msg, icon = "check") => {
    const id = Math.random();
    setToasts(t => [...t, { id, msg, icon }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div className="toast" key={t.id}>
            <Icon name={t.icon} size={18} style={{ color: "var(--ok)" }} /> {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
window.ToastHost = ToastHost;

/* Avatar from name */
function initials(name) {
  if (!name) return "?";
  const clean = name.replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง|ครู)/, "");
  return clean.trim().charAt(0);
}
window.initials = initials;

/* Empty state */
function Empty({ icon = "search", title, sub }) {
  return (
    <div className="empty">
      <Icon name={icon} size={46} stroke={1.5} />
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-2)" }}>{title}</div>
      {sub && <div style={{ marginTop: 5 }}>{sub}</div>}
    </div>
  );
}
window.Empty = Empty;

/* count-up hook */
function useCountUp(target, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, start, done = false;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / ms, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick); else done = true;
    };
    raf = requestAnimationFrame(tick);
    const safety = setTimeout(() => { if (!done) setN(target); }, ms + 250);
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); };
  }, [target]);
  return n;
}
window.useCountUp = useCountUp;

/* Page header */
function PageHead({ crumb, title, desc, actions }) {
  return (
    <div className="page-head">
      <div>
        {crumb && <div className="crumb">{crumb.map((c, i) => (
          <React.Fragment key={i}>{i > 0 && <Icon name="chevR" size={13} />}<span>{c}</span></React.Fragment>
        ))}</div>}
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}
window.PageHead = PageHead;

/* Managed dropdown of editable options: pick, add new, delete existing */
function ManagedTypeSelect({ options, value, onChange, onAdd, onDelete, addPlaceholder = "เพิ่มประเภทใหม่…" }) {
  const [open, setOpen] = useState(false);
  const [nv, setNv] = useState("");
  const add = () => { const t = nv.trim(); if (!t) return; onAdd(t); setNv(""); };
  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="select" style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", cursor: "pointer", background: "var(--surface)" }}>
        <span style={{ flex: 1 }}>{value || "— เลือก —"}</span>
        <Icon name="chevD" size={16} style={{ color: "var(--text-3)" }} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)}></div>
          <div className="card" style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, zIndex: 41, boxShadow: "var(--shadow-lg)", padding: 6, maxHeight: 280, overflowY: "auto" }}>
            {options.map(o => (
              <div key={o} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 2px" }}>
                <button type="button" onClick={() => { onChange(o); setOpen(false); }} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: 0, background: value === o ? "var(--surface-3)" : "transparent", padding: "9px 11px", borderRadius: 9, textAlign: "left", fontSize: 13.5, fontWeight: 500, color: "var(--text)", cursor: "pointer" }}>
                  {value === o && <Icon name="check" size={15} style={{ color: "var(--primary)" }} />}
                  <span style={{ marginLeft: value === o ? 0 : 23 }}>{o}</span>
                </button>
                {onDelete && options.length > 1 && (
                  <button type="button" onClick={e => { e.stopPropagation(); onDelete(o); }} className="icon-btn" style={{ width: 28, height: 28, flexShrink: 0 }} title="ลบประเภทนี้"><Icon name="trash" size={13} /></button>
                )}
              </div>
            ))}
            {onAdd && (
              <div style={{ display: "flex", gap: 6, padding: "8px 4px 4px", borderTop: "1px solid var(--border)", marginTop: 4 }}>
                <input className="input" style={{ flex: 1, fontSize: 13, height: 36 }} placeholder={addPlaceholder} value={nv} onChange={e => setNv(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
                <button type="button" className="btn btn-sm" disabled={!nv.trim()} onClick={add}><Icon name="plus" size={14} />เพิ่ม</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
window.ManagedTypeSelect = ManagedTypeSelect;

/* Photo upload — real <input type=file> with preview + remove */
function PhotoUpload({ value, onChange, multiple = true, hint = "ลากรูปมาวาง หรือคลิกเพื่ออัปโหลด", camera = true }) {
  const ref = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [over, setOver] = useState(false);
  const [cam, setCam] = useState(false);
  const [err, setErr] = useState("");
  const photos = value || [];
  const [facing, setFacing] = useState("environment");
  const readFiles = (fileList) => {
    const files = [...fileList].filter(f => f.type.startsWith("image/")).slice(0, multiple ? 6 : 1);
    let done = [];
    let pending = files.length;
    if (!pending) return;
    files.forEach(f => {
      const r = new FileReader();
      r.onload = () => {
        done.push({ src: r.result, name: f.name });
        if (--pending === 0) onChange(multiple ? [...photos, ...done].slice(0, 6) : done);
      };
      r.readAsDataURL(f);
    });
  };
  const stopCam = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCam(false);
  };
  useEffect(() => () => stopCam(), []);
  const openCam = async (mode) => {
    const want = mode || facing;
    setErr("");
    try {
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: want }, width: 1280, height: 960 } });
      streamRef.current = stream;
      setFacing(want);
      setCam(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 60);
    } catch (e) {
      setErr("ไม่สามารถเปิดกล้องได้ — กรุณาอนุญาตการใช้กล้อง หรือใช้การอัปโหลดรูปแทน");
    }
  };
  const flipCam = () => openCam(facing === "environment" ? "user" : "environment");
  const snap = () => {
    const v = videoRef.current; if (!v) return;
    const w = v.videoWidth || 640, h = v.videoHeight || 480;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (facing === "user") { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, w, h);
    const src = c.toDataURL("image/jpeg", 0.82);
    onChange(multiple ? [...photos, { src, name: "ถ่ายจากกล้อง" }].slice(0, 6) : [{ src, name: "ถ่ายจากกล้อง" }]);
    stopCam();
  };
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" multiple={multiple} style={{ display: "none" }}
        onChange={e => { readFiles(e.target.files); e.target.value = ""; }} />
      {photos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: "relative", width: 92, height: 92, borderRadius: 11, overflow: "hidden", border: "1px solid var(--border)" }}>
              <img src={p.src} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => onChange(photos.filter((_, j) => j !== i))} style={{
                position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", border: 0,
                background: "rgba(10,22,32,.7)", color: "#fff", display: "grid", placeItems: "center",
              }}><Icon name="close" size={13} /></button>
            </div>
          ))}
        </div>
      )}
      {cam ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 14, border: "1px solid var(--border)", borderRadius: 13, background: "var(--surface-2)" }}>
          <div style={{ width: "100%", maxWidth: 360, aspectRatio: "4/3", borderRadius: 12, overflow: "hidden", background: "#000", boxShadow: "var(--shadow)" }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : "none" }}></video>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn" onClick={stopCam}>ยกเลิก</button>
            <button type="button" className="btn" onClick={flipCam} title="สลับกล้องหน้า/หลัง"><Icon name="refresh" size={17} />สลับกล้อง</button>
            <button type="button" className="btn btn-primary" onClick={snap}><Icon name="camera" size={17} />ถ่ายภาพ</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          <div onClick={() => ref.current && ref.current.click()}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); readFiles(e.dataTransfer.files); }}
            style={{
              flex: 1, border: "2px dashed " + (over ? "var(--primary)" : "var(--border-strong)"), borderRadius: 13, padding: 24,
              textAlign: "center", color: over ? "var(--primary)" : "var(--text-3)", cursor: "pointer",
              background: over ? "var(--primary-soft)" : "transparent", transition: "all .15s",
            }}>
            <Icon name="image" size={28} stroke={1.5} />
            <div style={{ marginTop: 7, fontSize: 13.5 }}>{photos.length ? "เพิ่มรูปอีก" : hint}</div>
          </div>
          {camera && (
            <button type="button" onClick={() => openCam()} style={{
              width: 120, flexShrink: 0, border: "2px dashed var(--border-strong)", borderRadius: 13, background: "transparent",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, color: "var(--primary)", cursor: "pointer",
            }}>
              <Icon name="camera" size={26} stroke={1.6} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>เปิดกล้อง</span>
            </button>
          )}
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: "var(--danger)", marginTop: 7 }}>{err}</div>}
    </div>
  );
}
window.PhotoUpload = PhotoUpload;

/* Person photo field — upload OR live camera capture; returns a single dataURL via onChange */
function PersonPhotoField({ value, onChange, sex, label = "รูปภาพ" }) {
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cam, setCam] = useState(false);
  const [err, setErr] = useState("");
  const [facing, setFacing] = useState("user");

  const stop = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCam(false);
  };
  useEffect(() => () => stop(), []);

  const openCam = async (mode) => {
    const want = mode || facing;
    setErr("");
    try {
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: want }, width: 640, height: 640 } });
      streamRef.current = stream;
      setFacing(want);
      setCam(true);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 60);
    } catch (e) {
      setErr("ไม่สามารถเปิดกล้องได้ — กรุณาอนุญาตการใช้กล้อง หรือใช้การอัปโหลดรูปแทน");
    }
  };
  const flipCam = () => openCam(facing === "user" ? "environment" : "user");
  const snap = () => {
    const v = videoRef.current; if (!v) return;
    const side = Math.min(v.videoWidth, v.videoHeight);
    const c = document.createElement("canvas"); c.width = 320; c.height = 320;
    const ctx = c.getContext("2d");
    if (facing === "user") { ctx.translate(320, 0); ctx.scale(-1, 1); } // mirror selfie to match preview
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, 320, 320);
    onChange(c.toDataURL("image/jpeg", 0.85));
    stop();
  };
  const readFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const r = new FileReader(); r.onload = () => onChange(r.result); r.readAsDataURL(file);
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 7, color: "var(--text-2)" }}>{label}</label>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { readFile(e.target.files[0]); e.target.value = ""; }} />
      {cam ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 14, border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface-2)" }}>
          <div style={{ width: 200, height: 200, borderRadius: "50%", overflow: "hidden", background: "#000", boxShadow: "var(--shadow)" }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : "none" }}></video>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn" onClick={stop}>ยกเลิก</button>
            <button type="button" className="btn" onClick={flipCam} title="สลับกล้องหน้า/หลัง"><Icon name="refresh" size={17} />สลับกล้อง</button>
            <button type="button" className="btn btn-primary" onClick={snap}><Icon name="camera" size={17} />ถ่ายภาพ</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 92, height: 92, borderRadius: 16, overflow: "hidden", flexShrink: 0, border: "1px solid var(--border)", position: "relative" }}>
            {value
              ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div className={"avatar" + (sex === "หญิง" ? " orange" : "")} style={{ width: "100%", height: "100%", borderRadius: 0, fontSize: 30, display: "grid", placeItems: "center" }}><Icon name="user" size={36} stroke={1.5} /></div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => openCam()}><Icon name="camera" size={15} />เปิดกล้องถ่ายรูป</button>
              <button type="button" className="btn btn-sm" onClick={() => fileRef.current && fileRef.current.click()}><Icon name="upload" size={15} />อัปโหลด</button>
            </div>
            {value && <button type="button" className="btn btn-sm btn-ghost" style={{ color: "var(--danger)", justifyContent: "flex-start", padding: 0, height: "auto" }} onClick={() => onChange(null)}>ลบรูป</button>}
            {err ? <div style={{ fontSize: 12, color: "var(--danger)", maxWidth: 240 }}>{err}</div> : <div style={{ fontSize: 12, color: "var(--text-3)" }}>ถ่ายจากกล้อง หรือเลือกไฟล์รูป</div>}
          </div>
        </div>
      )}
    </div>
  );
}
window.PersonPhotoField = PersonPhotoField;

/* Accessory checklist — qty-aware checkboxes */
function AccessoryChecklist({ accessories, checked, onToggle, accent = "var(--ok)" }) {
  if (!accessories || accessories.length === 0)
    return <div style={{ color: "var(--text-3)", fontSize: 13.5, padding: "6px 2px" }}>อุปกรณ์นี้ไม่มีอุปกรณ์เสริมที่ลงทะเบียนไว้</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {accessories.map((a, i) => {
        const on = checked[i];
        return (
          <label key={i} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", borderRadius: 11, cursor: "pointer",
            border: "1px solid " + (on ? "color-mix(in srgb, " + accent + " 45%, transparent)" : "var(--border)"),
            background: on ? "color-mix(in srgb, " + accent + " 9%, transparent)" : "var(--surface)",
          }}>
            <input type="checkbox" checked={!!on} onChange={() => onToggle(i)} style={{ width: 18, height: 18, accentColor: accent }} />
            <span style={{ flex: 1, fontWeight: 500 }}>{a.name}</span>
            <span className="badge b-muted num">× {a.qty}</span>
          </label>
        );
      })}
    </div>
  );
}
window.AccessoryChecklist = AccessoryChecklist;

/* Accessory stock checklist — checkbox + qty stepper, reads live inventory */
function AccessoryStockChecklist({ accessories, chosen, onSet, accent = "var(--primary)" }) {
  if (!accessories || accessories.length === 0)
    return <div style={{ color: "var(--text-3)", fontSize: 13.5, padding: "6px 2px" }}>ยังไม่มีอุปกรณ์เสริมในคลัง</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {accessories.map((a) => {
        const qty = chosen[a.id] || 0;
        const on = qty > 0;
        return (
          <div key={a.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "9px 13px", borderRadius: 11,
            border: "1px solid " + (on ? "color-mix(in srgb, " + accent + " 45%, transparent)" : "var(--border)"),
            background: on ? "color-mix(in srgb, " + accent + " 9%, transparent)" : "var(--surface)",
          }}>
            <input type="checkbox" checked={on} onChange={() => onSet(a.id, on ? 0 : 1)} style={{ width: 18, height: 18, accentColor: accent }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500 }}>{a.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }} className="num">คงเหลือในคลัง {a.qty} ชิ้น</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: on ? 1 : .4, pointerEvents: on ? "auto" : "none" }}>
              <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => onSet(a.id, Math.max(1, qty - 1))}><Icon name="chevL" size={14} /></button>
              <span className="num" style={{ minWidth: 22, textAlign: "center", fontWeight: 700 }}>{qty || 1}</span>
              <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => onSet(a.id, Math.min(a.qty, qty + 1))}><Icon name="chevR" size={14} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
window.AccessoryStockChecklist = AccessoryStockChecklist;

/* Held-device cell — shows only the device tag(s) a person currently holds (live). */
function HeldDeviceCell({ person, go }) {
  useStore(); // re-render on store change
  const recs = borrowsOf(person);
  if (recs.length === 0) return <span style={{ color: "var(--text-3)" }}>—</span>;
  const rec = recs[0];
  return (
    <button className="num" onClick={e => { e.stopPropagation(); go && go("timeline"); }} title="ดูประวัติอุปกรณ์"
      style={{ fontWeight: 700, color: "var(--info)", border: 0, background: "transparent", padding: 0, cursor: "pointer" }}>
      {rec.device}{recs.length > 1 ? " +" + (recs.length - 1) : ""}
    </button>
  );
}
window.HeldDeviceCell = HeldDeviceCell;

/* Person device-usage status cell — 3 options driven by real records.
   "กำลังใช้งาน" (holding) · "คืนแล้ว" (returned) · "ไม่ประสงค์ยืม" (opted out).
   Choosing "คืนแล้ว" while holding a device jumps to the return-inspection page. */
function PersonStatusCell({ person, go }) {
  const [store] = useStore();
  const toast = React.useContext(ToastCtx);
  const [open, setOpen] = useState(false);
  const recs = borrowsOf(person);
  const holding = recs.length > 0;
  const status = personDeviceStatus(person);
  const meta = {
    "กำลังใช้งาน": { cls: "b-ok", color: "var(--ok)", soft: "var(--ok-soft)" },
    "คืนแล้ว": { cls: "b-info", color: "var(--info)", soft: "var(--info-soft)" },
    "ไม่ประสงค์ยืม": { cls: "b-muted", color: "var(--text-3)", soft: "var(--surface-3)" },
    "ยังไม่แจ้ง": { cls: "b-warn", color: "var(--warn)", soft: "var(--warn-soft)" },
  }[status] || { cls: "b-warn", color: "var(--warn)", soft: "var(--warn-soft)" };
  const opts = ["กำลังใช้งาน", "คืนแล้ว", "ไม่ประสงค์ยืม", "ยังไม่แจ้ง"];
  const accRepairing = window.hasActiveAccRepair && window.hasActiveAccRepair(person);
  const choose = (opt) => {
    setOpen(false);
    if (opt === status) return;
    if (opt === "คืนแล้ว") {
      if (holding) {
        // route to the return-inspection page for the held device
        const rec = recs[0];
        const dev = store.ipads.find(d => d.assetTag === rec.device || d.id === rec.deviceId)
          || { id: rec.deviceId, assetTag: rec.device, model: rec.model, type: "ipad", holder: rec.holder, holderLevel: rec.level, status: "ถูกยืม", statusCls: "b-info" };
        go && go("borrow", { mode: "return", device: dev });
        return;
      }
      setPersonStatus(person, "คืนแล้ว");
      toast("อัปเดตสถานะเป็น “คืนแล้ว”");
      return;
    }
    if (opt === "กำลังใช้งาน" && !holding) {
      toast("ยังไม่มีอุปกรณ์ที่ถือครอง — ทำรายการยืมก่อน", "alert");
      go && go("borrow");
      return;
    }
    setPersonStatus(person, opt);
    toast("อัปเดตสถานะเป็น “" + opt + "”");
  };
  return (
    <div onClick={e => e.stopPropagation()} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button onClick={() => setOpen(o => !o)} title="เปลี่ยนสถานะการยืม–คืน"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid " + meta.color, background: meta.soft, color: meta.color, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }}></span>{status}<Icon name="chevD" size={12} />
      </button>
      {accRepairing && <span title="กำลังส่งซ่อมอุปกรณ์เสริม" style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--warn)", background: "var(--warn-soft)", color: "var(--warn)", borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}><Icon name="repair" size={11} />ส่งซ่อมเสริม</span>}
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)}></div>
          <div className="card" style={{ position: "absolute", left: 0, top: "calc(100% + 6px)", zIndex: 41, boxShadow: "var(--shadow-lg)", padding: 6, minWidth: 184 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", padding: "4px 10px 6px" }}>เปลี่ยนสถานะการยืม–คืน</div>
            {opts.map(opt => (
              <button key={opt} onClick={() => choose(opt)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: 0, background: opt === status ? "var(--surface-3)" : "transparent", padding: "8px 10px", borderRadius: 9, textAlign: "left", fontSize: 13.5, fontWeight: 500, color: "var(--text)", cursor: "pointer" }}>
                <Badge cls={{ "กำลังใช้งาน": "b-ok", "คืนแล้ว": "b-info", "ไม่ประสงค์ยืม": "b-muted", "ยังไม่แจ้ง": "b-warn" }[opt]} dot>{opt}</Badge>
                {opt === status && <Icon name="check" size={15} style={{ marginLeft: "auto", color: "var(--primary)" }} />}
                {opt === "คืนแล้ว" && holding && opt !== status && <Icon name="chevR" size={14} style={{ marginLeft: "auto", color: "var(--text-3)" }} />}
              </button>
            ))}
            {holding && <div style={{ fontSize: 11, color: "var(--text-3)", padding: "6px 10px 3px", lineHeight: 1.4 }}>เลือก “คืนแล้ว” เพื่อไปหน้าตรวจสอบการคืนเครื่อง</div>}
          </div>
        </>
      )}
    </div>
  );
}
window.PersonStatusCell = PersonStatusCell;

/* ===== Excel export (HTML-table .xls, Thai-safe) ===== */
function exportExcel(filename, headers, rows) {
  const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const head = "<tr>" + headers.map(h => `<th style="background:#1aa6e0;color:#fff;border:1px solid #ccc;padding:6px 10px;font-family:sans-serif">${esc(h)}</th>`).join("") + "</tr>";
  const body = rows.map(r => "<tr>" + r.map(c => `<td style="border:1px solid #ddd;padding:5px 10px;font-family:sans-serif">${esc(c)}</td>`).join("") + "</tr>").join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${head}${body}</table></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename.endsWith(".xls") ? filename : filename + ".xls";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
window.exportExcel = exportExcel;

function downloadTemplate(filename, headers, sample) {
  exportExcel(filename, headers, sample ? [sample] : []);
}
window.downloadTemplate = downloadTemplate;

/* ===== Print-ready PDF report (opens print dialog) ===== */
function printReport(title, headers, rows) {
  const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const today = "5 มิถุนายน 2569";
  const head = "<tr>" + headers.map(h => `<th>${esc(h)}</th>`).join("") + "</tr>";
  const body = rows.map(r => "<tr>" + r.map(c => `<td>${esc(c)}</td>`).join("") + "</tr>").join("");
  const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>${esc(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Anuphan:wght@400;600;700&display=swap');
    * { font-family: 'Anuphan', sans-serif; }
    body { margin: 32px; color: #16242e; }
    .rh { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #1aa6e0; padding-bottom: 14px; margin-bottom: 20px; }
    .rh .logo { width: 52px; height: 52px; border-radius: 11px; background: #1aa6e0; color:#fff; display:grid; place-items:center; font-weight:700; font-size:20px; }
    .rh h1 { font-size: 20px; margin: 0; }
    .rh .sub { color: #6b7a86; font-size: 13px; margin-top: 2px; }
    .meta { display:flex; justify-content: space-between; font-size: 12.5px; color:#6b7a86; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th { background: #1aa6e0; color: #fff; text-align: left; padding: 8px 10px; }
    td { border-bottom: 1px solid #e3e9ee; padding: 7px 10px; }
    tr:nth-child(even) td { background: #f6f9fb; }
    .ft { margin-top: 22px; font-size: 11px; color: #9aa7b1; text-align: center; border-top: 1px solid #e3e9ee; padding-top: 12px; }
    @media print { .noprint { display: none; } body { margin: 12mm; } }
    .btnbar { position: fixed; top: 16px; right: 16px; }
    .btnbar button { font-family:'Anuphan'; background:#1aa6e0; color:#fff; border:0; padding:10px 18px; border-radius:9px; font-weight:600; font-size:14px; cursor:pointer; }
  </style></head><body>
  <div class="btnbar noprint"><button onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button></div>
  <div class="rh"><div class="logo">นหพ</div><div><h1>${esc(title)}</h1><div class="sub">โรงเรียนหนองหงส์พิทยาคม · สพม.บุรีรัมย์</div></div></div>
  <div class="meta"><span>ปีการศึกษา 2569 · ภาคเรียนที่ 1</span><span>พิมพ์เมื่อ ${today} · ${rows.length} รายการ</span></div>
  <table><thead>${head}</thead><tbody>${body}</tbody></table>
  <div class="ft">NHP iPad Management System — รายงานนี้สร้างโดยระบบอัตโนมัติ</div>
  <script>setTimeout(function(){window.print();}, 600);<\/script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); return true; }
  // fallback: download as .html
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = title + ".html";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return false;
}
window.printReport = printReport;

/* ===== Single-device asset sticker (QR + asset tag) — opens print dialog ===== */
function printSticker(device) {
  const school = (window.Store && window.Store.snapshot().school && window.Store.snapshot().school.name) || "โรงเรียนหนองหงส์พิทยาคม";
  const cell = `
    <div class="sticker">
      <div class="sch">${school}</div>
      ${qrSVGString(device.assetTag, 150)}
      <div class="tag">${device.assetTag}</div>
      <div class="code">${device.code || ""}</div>
    </div>`;
  const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>สติกเกอร์ ${device.assetTag}</title>
    <style>@page{size:A4;margin:14mm} body{margin:0;font-family:'Anuphan',sans-serif;display:flex;flex-direction:column;align-items:center;padding:30px}
    .sticker{border:1.5px solid #d4dce2;border-radius:12px;padding:18px 22px;display:flex;flex-direction:column;align-items:center;gap:7px;background:#fff;width:230px}
    .sch{font-size:13px;font-weight:700;color:#1488bd}
    .tag{font-size:17px;font-weight:800;color:#16242e;letter-spacing:.3px}
    .code{font-size:12px;color:#7e8f9c}
    .btnbar{position:fixed;top:14px;right:14px} .btnbar button{background:#1aa6e0;color:#fff;border:0;padding:10px 18px;border-radius:9px;font-weight:600;cursor:pointer;font-family:sans-serif}
    @media print{.btnbar{display:none}}</style></head>
    <body><div class="btnbar"><button onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button></div>
    ${cell}
    <script>setTimeout(function(){window.print();},500);<\/script></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); return true; }
  const blob = new Blob([html], { type: "text/html" }); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "สติกเกอร์_" + device.assetTag + ".html"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return false;
}
window.printSticker = printSticker;

/* ===== Import modal — template download, file pick, validate, import ===== */
function ImportModal({ title, headers, templateName, sampleRow, existing = [], existingKeys = [], buildRecord, keyOf, onClose, onImport }) {
  const toast = React.useContext(ToastCtx);
  const ref = useRef(null);
  const [file, setFile] = useState(null);
  const [over, setOver] = useState(false);
  const [parsed, setParsed] = useState(null); // { total, valid, inserted, updated, invalid, records, updates, preview }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // real XLSX/CSV parsing via SheetJS — รายการใหม่ = เพิ่ม, รายการที่มีอยู่ = อัปเดต (merge ข้อมูลที่เพิ่มมา)
  const handleFile = (f) => {
    if (!f) return;
    setFile(f); setBusy(true); setParsed(null); setErr(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (typeof XLSX === "undefined") throw new Error("no-xlsx");
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        let aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
        // drop a header row if present (first cell matches first column header)
        if (aoa.length && String(aoa[0][0]).trim() === String(headers[0]).trim()) aoa = aoa.slice(1);
        // map ของที่มีอยู่ในระบบ (key -> record) เพื่อ merge
        const existMap = {};
        (existing || []).forEach(rec => { const k = String(keyOf ? keyOf(rec) : "").trim().toLowerCase(); if (k) existMap[k] = rec; });
        (existingKeys || []).forEach(k => { const kk = String(k).trim().toLowerCase(); if (kk && !existMap[kk]) existMap[kk] = true; });
        const seen = new Set();
        const records = []; const updates = []; const previewRows = []; let invalid = 0;
        aoa.forEach(row => {
          if (!row || row.every(c => String(c).trim() === "")) return;
          const fresh = buildRecord ? buildRecord(row, null) : row;
          const key = String(fresh && keyOf ? keyOf(fresh) : (row[0] || "")).trim().toLowerCase();
          if (!fresh || !key) { invalid++; return; }
          if (seen.has(key)) return;  // ซ้ำภายในไฟล์เดียวกัน — ข้าม
          seen.add(key);
          const match = existMap[key];
          if (match && match !== true) {
            updates.push(buildRecord ? buildRecord(row, match) : fresh);  // อัปเดต/merge เข้าของเดิม
            if (previewRows.length < 4) previewRows.push({ row, dup: true });
          } else if (match === true) {
            if (previewRows.length < 4) previewRows.push({ row, dup: true });  // มีอยู่แต่ไม่มี record ให้ merge → ข้าม
          } else {
            records.push(fresh);
            if (previewRows.length < 4) previewRows.push({ row, dup: false });
          }
        });
        setParsed({ total: records.length + updates.length + invalid, valid: records.length + updates.length, inserted: records.length, updated: updates.length, invalid, records, updates, preview: previewRows });
        setBusy(false);
      } catch (er) {
        setBusy(false);
        setErr(er.message === "no-xlsx" ? "ไลบรารีอ่าน Excel ยังโหลดไม่เสร็จ ลองอีกครั้ง" : "ไม่สามารถอ่านไฟล์ได้ — กรุณาใช้ไฟล์ .xlsx / .csv ตาม Template");
      }
    };
    reader.onerror = () => { setBusy(false); setErr("อ่านไฟล์ไม่สำเร็จ"); };
    reader.readAsArrayBuffer(f);
  };

  return (
    <Modal title={title} onClose={onClose} wide
      footer={<>
        <button className="btn" style={{ marginRight: "auto" }} onClick={() => downloadTemplate(templateName, headers, sampleRow)}><Icon name="download" size={16} />ดาวน์โหลด Template</button>
        <button className="btn" onClick={onClose}>ยกเลิก</button>
        <button className="btn btn-primary" disabled={!parsed || busy || parsed.valid === 0} onClick={() => { onImport(parsed); onClose(); }}><Icon name="check" size={16} />นำเข้า {parsed ? parsed.valid + " รายการ" : ""}</button>
      </>}>
      <div style={{ display: "flex", gap: 9, marginBottom: 16, padding: 13, background: "var(--info-soft)", borderRadius: 12, color: "var(--info)", fontSize: 13.5 }}>
        <Icon name="alert" size={18} style={{ flexShrink: 0 }} /><span>ดาวน์โหลด Template ก่อน กรอกข้อมูลตามคอลัมน์ แล้วอัปโหลดไฟล์ .xlsx / .csv ระบบจะอ่านข้อมูลจริงและข้ามรายชื่อที่มีอยู่แล้วในระบบให้อัตโนมัติ</span>
      </div>

      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
        onChange={e => handleFile(e.target.files[0])} />
      <div onClick={() => ref.current && ref.current.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files[0]); }}
        style={{
          border: "2px dashed " + (over ? "var(--primary)" : "var(--border-strong)"), borderRadius: 13, padding: 30,
          textAlign: "center", color: over ? "var(--primary)" : "var(--text-3)", cursor: "pointer",
          background: over ? "var(--primary-soft)" : "transparent", transition: "all .15s",
        }}>
        <Icon name="upload" size={32} stroke={1.5} />
        <div style={{ marginTop: 9, fontSize: 14, fontWeight: 600, color: file ? "var(--text)" : "var(--text-2)" }}>{file ? file.name : "คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์มาวาง"}</div>
        <div style={{ fontSize: 12.5, marginTop: 4 }}>รองรับ .xlsx, .xls, .csv</div>
      </div>

      {busy && <div style={{ textAlign: "center", padding: 16, color: "var(--text-3)" }}><Icon name="refresh" size={20} /> กำลังอ่านและตรวจสอบข้อมูล…</div>}
      {err && <div style={{ marginTop: 14, display: "flex", gap: 9, padding: 13, background: "var(--danger-soft)", borderRadius: 11, color: "var(--danger)", fontSize: 13.5 }}><Icon name="alert" size={17} style={{ flexShrink: 0 }} />{err}</div>}

      {parsed && !busy && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            <div className="card card-pad" style={{ textAlign: "center", padding: 14 }}><div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{parsed.total}</div><div style={{ fontSize: 12.5, color: "var(--text-3)" }}>พบในไฟล์</div></div>
            <div className="card card-pad" style={{ textAlign: "center", padding: 14 }}><div className="num" style={{ fontSize: 24, fontWeight: 700, color: "var(--ok)" }}>{parsed.valid}</div><div style={{ fontSize: 12.5, color: "var(--text-3)" }}>พร้อมนำเข้า</div></div>
            <div className="card card-pad" style={{ textAlign: "center", padding: 14 }}><div className="num" style={{ fontSize: 24, fontWeight: 700, color: parsed.updated ? "var(--info)" : "var(--text-3)" }}>{parsed.updated}</div><div style={{ fontSize: 12.5, color: "var(--text-3)" }}>อัปเดตข้อมูลเดิม</div></div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-3)", textAlign: "center" }}>รายการใหม่จะถูกเพิ่ม · รายการที่มีอยู่แล้วจะถูกอัปเดตด้วยข้อมูลที่กรอกเพิ่มมา</div>
          {parsed.valid === 0 && <div style={{ marginTop: 12, fontSize: 13, color: "var(--warn)", textAlign: "center" }}>ไม่มีข้อมูลให้นำเข้า</div>}
          {parsed.preview && parsed.preview.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 12 }}>
              <table className="tbl"><thead><tr>{headers.slice(0, 4).map(h => <th key={h}>{h}</th>)}<th>สถานะ</th></tr></thead>
                <tbody>
                  {parsed.preview.map((pr, i) => (
                    <tr key={i}>{pr.row.slice(0, 4).map((c, j) => <td key={j}>{String(c)}</td>)}<td>{pr.dup ? <Badge cls="b-info" dot>อัปเดต</Badge> : <Badge cls="b-ok" dot>เพิ่มใหม่</Badge>}</td></tr>
                  ))}
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>… แสดงตัวอย่างจากไฟล์จริง</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
window.ImportModal = ImportModal;
