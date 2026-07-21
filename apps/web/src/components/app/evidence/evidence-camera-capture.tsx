"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  ImageIcon,
  RefreshCw,
  ShieldCheck,
  SwitchCamera,
  Zap
} from "lucide-react";
import { EvidenceImportHero } from "@/components/app/evidence/evidence-import-hero";
import { Button } from "@/components/ui/button";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface EvidenceCameraCaptureProps {
  caseRecord: CaseRecord;
  onCancel: () => void;
  onCapture: (file: File) => void;
}

type CameraStatus = "requesting" | "ready" | "unavailable";
type FacingMode = "environment" | "user";
type TorchConstraint = MediaTrackConstraintSet & { torch: boolean };

export function EvidenceCameraCapture({
  caseRecord,
  onCancel,
  onCapture
}: EvidenceCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("requesting");
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTorchAvailable, setIsTorchAvailable] = useState(false);
  const [isTorchEnabled, setIsTorchEnabled] = useState(false);
  const [message, setMessage] = useState("Requesting camera access...");

  useEffect(() => {
    let isActive = true;
    const currentVideo = videoRef.current;

    async function openCamera() {
      stopCameraStream(streamRef.current);
      streamRef.current = null;
      setStatus("requesting");
      setIsTorchAvailable(false);
      setIsTorchEnabled(false);
      setMessage("Requesting camera access...");

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        setMessage("Live camera capture is not supported by this browser.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            height: { ideal: 1440 },
            width: { ideal: 1920 }
          }
        });

        if (!isActive) {
          stopCameraStream(stream);
          return;
        }

        streamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack?.getCapabilities() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        setIsTorchAvailable(Boolean(capabilities?.torch));

        if (currentVideo) {
          currentVideo.srcObject = stream;
          await currentVideo.play();
        }

        setStatus("ready");
        setMessage("Camera ready. Align the document inside the frame.");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setStatus("unavailable");
        setMessage(getCameraErrorMessage(error));
      }
    }

    void openCamera();

    return () => {
      isActive = false;
      if (currentVideo) {
        currentVideo.srcObject = null;
      }
      stopCameraStream(streamRef.current);
      streamRef.current = null;
    };
  }, [facingMode]);

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (file) {
      onCapture(file);
    }
  }

  async function handleCapture() {
    const video = videoRef.current;

    if (!video || status !== "ready" || !video.videoWidth || !video.videoHeight) {
      setMessage("The camera is still preparing. Try again in a moment.");
      return;
    }

    setIsCapturing(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("This browser could not capture the camera frame.");
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await getCapturedBlob(canvas);
      onCapture(
        new File([blob], `proofpilot-scan-${Date.now()}.jpg`, {
          lastModified: Date.now(),
          type: "image/jpeg"
        })
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The camera frame could not be captured.");
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleTorchToggle() {
    const track = streamRef.current?.getVideoTracks()[0];

    if (!track || !isTorchAvailable) {
      return;
    }

    const nextTorchState = !isTorchEnabled;

    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorchState } as TorchConstraint]
      });
      setIsTorchEnabled(nextTorchState);
    } catch {
      setIsTorchAvailable(false);
      setIsTorchEnabled(false);
      setMessage("Flash control is not available on this device.");
    }
  }

  return (
    <section aria-labelledby="camera-capture-heading" className="grid gap-5">
      <header className="flex items-start gap-3">
        <Button
          aria-label="Back to evidence sources"
          className="shrink-0"
          onClick={onCancel}
          size="icon"
          title="Back to evidence sources"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div>
          <p className="text-sm font-semibold text-primary">Evidence capture</p>
          <h1
            className="mt-1 text-2xl font-semibold sm:text-3xl"
            id="camera-capture-heading"
            tabIndex={-1}
          >
            Scan document
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Capture a clear, readable image before adding it to the case.
          </p>
        </div>
      </header>

      <EvidenceImportHero caseRecord={caseRecord} />

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="relative aspect-[4/3] min-h-72 overflow-hidden bg-black sm:min-h-[30rem]">
          <video
            aria-label="Live document camera"
            autoPlay
            className={cn(
              "h-full w-full object-cover transition-opacity",
              status === "ready" ? "opacity-100" : "opacity-25"
            )}
            muted
            playsInline
            ref={videoRef}
          />

          {status !== "ready" ? (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div className="max-w-sm">
                {status === "requesting" ? (
                  <RefreshCw className="mx-auto h-9 w-9 animate-spin text-primary" aria-hidden="true" />
                ) : (
                  <CameraOff className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
                )}
                <p className="mt-4 text-sm font-semibold text-foreground">
                  {status === "requesting" ? "Preparing camera" : "Live camera unavailable"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-[8%] rounded-md border border-primary/70" aria-hidden="true">
            <span className="absolute -left-px -top-px h-12 w-12 border-l-4 border-t-4 border-primary" />
            <span className="absolute -right-px -top-px h-12 w-12 border-r-4 border-t-4 border-primary" />
            <span className="absolute -bottom-px -left-px h-12 w-12 border-b-4 border-l-4 border-primary" />
            <span className="absolute -bottom-px -right-px h-12 w-12 border-b-4 border-r-4 border-primary" />
          </div>

          <p className="absolute left-1/2 top-4 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-md border border-white/10 bg-black/75 px-3 py-2 text-center text-xs text-white sm:text-sm" role="status">
            {status === "ready" ? "Align the document inside the frame" : "Camera preview"}
          </p>
        </div>

        <div className="grid gap-5 border-t border-border p-4 sm:p-5">
          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            The captured image stays on this device until you approve its private signed upload.
          </p>

          <div className="grid grid-cols-3 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div className="flex justify-start gap-2">
              <Button
                aria-label={isTorchEnabled ? "Turn flash off" : "Turn flash on"}
                aria-pressed={isTorchEnabled}
                disabled={!isTorchAvailable || status !== "ready"}
                onClick={() => {
                  void handleTorchToggle();
                }}
                size="icon"
                title={isTorchAvailable ? "Flash" : "Flash unavailable"}
                type="button"
                variant="outline"
              >
                <Zap className="h-5 w-5" aria-hidden="true" />
              </Button>
              <Button
                aria-label="Switch camera"
                disabled={status === "requesting"}
                onClick={() =>
                  setFacingMode((currentMode) =>
                    currentMode === "environment" ? "user" : "environment"
                  )
                }
                size="icon"
                title="Switch camera"
                type="button"
                variant="outline"
              >
                <SwitchCamera className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <Button
              aria-label="Capture document"
              className="h-20 w-20 justify-self-center rounded-full border-4 border-background ring-2 ring-primary"
              disabled={status !== "ready" || isCapturing}
              onClick={() => {
                void handleCapture();
              }}
              size="icon"
              title="Capture document"
              type="button"
            >
              <Camera className="h-7 w-7" aria-hidden="true" />
            </Button>

            <div className="flex justify-end">
              <Button asChild size="icon" title="Choose image" variant="outline">
                <label className="cursor-pointer">
                  <input
                    accept="image/png,image/jpeg"
                    aria-label="Choose scan image"
                    className="sr-only"
                    onChange={handleFileSelection}
                    type="file"
                  />
                  <ImageIcon className="h-5 w-5" aria-hidden="true" />
                </label>
              </Button>
            </div>
          </div>

          {status === "unavailable" ? (
            <Button asChild className="w-full" variant="outline">
              <label className="cursor-pointer">
                <input
                  accept="image/png,image/jpeg"
                  aria-label="Open device camera"
                  capture="environment"
                  className="sr-only"
                  onChange={handleFileSelection}
                  type="file"
                />
                <Camera className="h-4 w-4" aria-hidden="true" />
                Use device camera instead
              </label>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function getCapturedBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("The camera frame could not be saved."));
      },
      "image/jpeg",
      0.92
    );
  });
}

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Camera access was denied. Allow access in browser settings or choose an image instead.";
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No camera was found. Choose an existing image or use this page on a camera-enabled device.";
  }

  return "The camera could not be started. Choose an existing image or use the device-camera fallback.";
}
