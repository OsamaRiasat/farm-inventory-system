"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Black-and-white QR code as inline SVG. Scanning it opens the slip (or the waiting receipt) in the app. */
export function QrCode({ value, size = 88 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let live = true;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" }).then((s) => live && setSvg(s));
    return () => {
      live = false;
    };
  }, [value]);

  return (
    <div
      role="img"
      aria-label={value}
      data-qr={value}
      style={{ width: size, height: size }}
      className="shrink-0"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
