import { useEffect, useRef, useState } from "react";

const DESIGN_W = 900;
const DESIGN_H = 636; // 297 : 210

const NAVY = "#1b2a4a";
const NAVY_SOFT = "#2a3c64";
const GOLD = "#c9a24a";
const GOLD_SOFT = "#dec896";
const GREY = "#78808f";

const serifStack = 'Georgia, "Times New Roman", "Iowan Old Style", serif';

function Field({ label, value, style }) {
  return (
    <div style={{ padding: "0 14px", ...style }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: GREY }}>{label}</p>
      <p style={{ marginTop: 3, fontSize: 14, fontWeight: 700, color: NAVY }}>{value}</p>
    </div>
  );
}

/** The fixed-size certificate artwork. Scale it with <CertificateView>. */
export function CertificateCanvas({
  recipientName,
  examLabel = "AISTP Software Testing Certification",
  scorePercent,
  issuedAt,
  certificateId,
}) {
  const issued = issuedAt
    ? new Date(issuedAt)
        .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        .toUpperCase()
    : "";

  return (
    <div
      style={{
        position: "relative",
        width: DESIGN_W,
        height: DESIGN_H,
        background: "#fbf9f4",
        color: NAVY,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        overflow: "hidden",
      }}
    >
      <svg
        viewBox="0 0 297 210"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-hidden="true"
      >
        <polygon points="8,8 44,8 8,44" fill={NAVY} />
        <polygon points="289,8 253,8 289,44" fill={NAVY} />
        <polygon points="8,202 44,202 8,166" fill={NAVY} />
        <polygon points="289,202 253,202 289,166" fill={NAVY} />
        <polygon points="10,10 30,10 10,30" fill={GOLD} />
        <polygon points="287,10 267,10 287,30" fill={GOLD} />
        <polygon points="10,200 30,200 10,180" fill={GOLD} />
        <polygon points="287,200 267,200 287,180" fill={GOLD} />
        <rect x="8" y="8" width="281" height="194" fill="none" stroke={NAVY} strokeWidth="1.4" />
        <rect x="11" y="11" width="275" height="188" fill="none" stroke={GOLD} strokeWidth="0.5" />
        <g opacity="0.06" fill={NAVY}>
          <polygon points="235,205 297,120 297,205" />
          <polygon points="255,205 297,150 297,205" />
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "44px 74px 36px",
        }}
      >
        <div style={{ display: "flex", width: "100%", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
              <polygon points="0,27 15,3 30,27" fill={NAVY} />
              <polygon points="16,27 21,16 27,27" fill={GOLD} />
            </svg>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1 }}>AISTP</p>
              <p style={{ marginTop: 4, fontSize: 8.5, letterSpacing: "0.14em", color: GREY }}>
                AI-ASSISTED SOFTWARE TESTING PLATFORM
              </p>
            </div>
          </div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: NAVY, whiteSpace: "nowrap" }}>
            LEARN&nbsp;&nbsp;/&nbsp;&nbsp;PRACTICE&nbsp;&nbsp;/&nbsp;&nbsp;CERTIFY&nbsp;&nbsp;/&nbsp;&nbsp;GROW
          </p>
        </div>

        <h1 style={{ marginTop: 22, fontFamily: serifStack, fontSize: 40, fontWeight: 700, letterSpacing: "0.05em", color: NAVY }}>
          CERTIFICATE OF ACHIEVEMENT
        </h1>
        <div style={{ margin: "14px 0 10px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ height: 1, width: 70, background: GOLD }} />
          <span style={{ height: 8, width: 8, transform: "rotate(45deg)", background: GOLD }} />
          <span style={{ height: 1, width: 70, background: GOLD }} />
        </div>

        <p style={{ fontSize: 14, color: NAVY_SOFT }}>This certificate is proudly presented to</p>
        <p
          style={{
            marginTop: 8,
            fontFamily: serifStack,
            fontSize: 42,
            fontWeight: 700,
            color: NAVY,
            borderBottom: `1px solid ${GOLD}`,
            padding: "0 30px 8px",
            maxWidth: "88%",
          }}
        >
          {recipientName}
        </p>

        <p style={{ marginTop: 22, fontSize: 12.5, color: NAVY_SOFT }}>for successfully completing</p>
        <p style={{ marginTop: 6, fontSize: 21, fontWeight: 800, letterSpacing: "0.02em", color: NAVY }}>
          {examLabel}
        </p>
        <p style={{ marginTop: 8, maxWidth: 460, fontSize: 12, lineHeight: 1.6, color: NAVY_SOFT }}>
          and demonstrating knowledge and competency in software testing principles,
          techniques and practices.
        </p>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            width: "100%",
            maxWidth: 640,
            justifyContent: "center",
            borderTop: `1px solid ${GOLD_SOFT}`,
            paddingTop: 14,
          }}
        >
          <Field label="ISSUED ON" value={issued} />
          <Field label="SCORE" value={`${scorePercent}%`} style={{ borderLeft: `1px solid ${GOLD_SOFT}`, borderRight: `1px solid ${GOLD_SOFT}` }} />
          <Field label="CERTIFICATE ID" value={certificateId} />
        </div>

        <div style={{ marginTop: 18, display: "flex", width: "100%", alignItems: "flex-end", justifyContent: "space-between", fontSize: 10, color: GREY }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: serifStack, fontStyle: "italic", fontSize: 17, color: NAVY, borderBottom: `1px solid ${NAVY}`, padding: "0 26px 4px" }}>
              AISTP
            </p>
            <p style={{ marginTop: 4, fontWeight: 700, color: NAVY }}>Authorized Signature</p>
            <p>AISTP Platform</p>
          </div>

          <div
            style={{
              display: "flex",
              height: 74,
              width: 74,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "9999px",
              border: `2px solid ${GOLD}`,
              background: NAVY,
              color: "#fff",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800 }}>AISTP</span>
            <span style={{ fontSize: 7, letterSpacing: "0.2em", color: GOLD_SOFT }}>CERTIFIED</span>
          </div>

          <div style={{ maxWidth: "40%", textAlign: "right" }}>
            <p style={{ fontWeight: 700, letterSpacing: "0.14em", fontSize: 9, color: GREY }}>
              AISTP CREDENTIAL
            </p>
            <p style={{ marginTop: 3, fontWeight: 700, fontSize: 13, color: NAVY }}>
              {certificateId}
            </p>
            {issued ? <p style={{ marginTop: 3 }}>Issued {issued} by AISTP</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Scales <CertificateCanvas> down to fit its container width. */
export default function CertificateView(props) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setScale(Math.min(1, el.clientWidth / DESIGN_W));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="w-full">
      <div
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          marginBottom: (scale - 1) * DESIGN_H,
          boxShadow: "0 10px 40px -12px rgba(27,42,74,0.35)",
        }}
      >
        <CertificateCanvas {...props} />
      </div>
    </div>
  );
}
