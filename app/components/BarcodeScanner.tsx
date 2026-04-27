"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

type Props = {
  onDetected: (barcode: string) => void;
  onCancel: () => void;
};

export default function BarcodeScanner({ onDetected, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const back =
          devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];
        if (!back) {
          setError("No camera found on this device.");
          return;
        }
        if (cancelled || !videoRef.current) return;

        const controls = await reader.decodeFromVideoDevice(
          back.deviceId,
          videoRef.current,
          (result, _err, ctrl) => {
            if (result) {
              ctrl.stop();
              onDetected(result.getText());
            }
          },
        );
        controlsRef.current = controls;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Camera unavailable";
        setError(
          msg.toLowerCase().includes("permission")
            ? "Camera permission denied. Allow camera access and try again."
            : msg,
        );
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black">
      <div className="flex items-center justify-between bg-black/80 px-5 py-4 text-paper">
        <div>
          <div className="text-sm font-medium">Scan barcode</div>
          <div className="text-xs text-paper/60">
            Hold the barcode steady inside the frame.
          </div>
        </div>
        <button
          onClick={onCancel}
          className="rounded-full border border-paper/30 px-3 py-1.5 text-xs text-paper"
        >
          Close
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-72 rounded-2xl border-2 border-paper/80" />
        </div>
        {error && (
          <div className="absolute inset-x-0 bottom-0 mx-5 mb-6 rounded-2xl bg-rose-100 p-4 text-center text-sm text-rose-900">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
