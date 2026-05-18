"use client";

import { useRef, useState } from "react";
import { scanReceipt } from "@/lib/ai/ocr";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Upload,
  ScanLine,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATES = {
  IDLE: "idle",
  SCANNING: "scanning",
  SUCCESS: "success",
  ERROR: "error",
  BLUR: "blur",
};

/**
 * ReceiptScanner — Upload or take a photo of a receipt and extract data via Gemini Vision.
 * @param {{ onScanComplete: (data: object) => void }} props
 */
export function ReceiptScanner({ onScanComplete }) {
  const [state, setState] = useState(STATES.IDLE);
  const [preview, setPreview] = useState(null); // object URL for thumbnail
  const [errorMsg, setErrorMsg] = useState("");
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const uploadInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // ── file selection (from either input) ───────────────────────────────────
  const handleFileSelected = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      setErrorMsg("Please select an image file.");
      setState(STATES.ERROR);
      return;
    }
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setState(STATES.IDLE);
    setErrorMsg("");
  };

  // ── drag-and-drop ─────────────────────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFileSelected(dropped);
  };

  // ── scan ──────────────────────────────────────────────────────────────────
  const handleScan = async () => {
    if (!file) return;
    setState(STATES.SCANNING);
    setErrorMsg("");

    try {
      const data = await scanReceipt(file);
      setState(STATES.SUCCESS);
      onScanComplete(data);
    } catch (err) {
      if (err.message === "blur") {
        setState(STATES.BLUR);
        setErrorMsg(
          "The image is unclear or not a receipt. Please upload a sharper photo."
        );
      } else {
        setState(STATES.ERROR);
        setErrorMsg(err.message || "Scan failed. Please try again.");
      }
    }
  };

  // ── clear ─────────────────────────────────────────────────────────────────
  const handleClear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setState(STATES.IDLE);
    setErrorMsg("");
    if (uploadInputRef.current) uploadInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const isScanning = state === STATES.SCANNING;

  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ScanLine className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">
          Smart Scan — Auto-fill from receipt
        </span>
      </div>

      {/* Drop zone / preview */}
      {!preview ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => uploadInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            Drag &amp; drop a receipt image, or choose below
          </p>
        </div>
      ) : (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Receipt preview"
            className="h-36 w-auto rounded-lg object-cover border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setIsPreviewOpen(true)}
            title="Click to view full image"
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 shadow hover:scale-110 transition-transform"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Hidden inputs */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => uploadInputRef.current?.click()}
          disabled={isScanning}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Upload Receipt
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isScanning}
        >
          <Camera className="h-3.5 w-3.5 mr-1.5" />
          Take Photo
        </Button>

        {file && !isScanning && state !== STATES.SUCCESS && (
          <Button
            type="button"
            size="sm"
            onClick={handleScan}
            className="ml-auto"
          >
            <ScanLine className="h-3.5 w-3.5 mr-1.5" />
            Scan Receipt
          </Button>
        )}

        {isScanning && (
          <Button type="button" size="sm" disabled className="ml-auto">
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Scanning…
          </Button>
        )}
      </div>

      {/* Status messages */}
      {state === STATES.SUCCESS && (
        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          Receipt scanned! Form has been auto-filled — review &amp; adjust.
        </div>
      )}

      {(state === STATES.ERROR || state === STATES.BLUR) && errorMsg && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Full-screen preview modal */}
      {isPreviewOpen && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Full receipt preview"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
            />
            <button
              type="button"
              className="absolute -top-4 -right-4 bg-background text-foreground rounded-full p-2 shadow-lg hover:bg-muted transition-colors"
              onClick={() => setIsPreviewOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
