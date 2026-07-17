"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Point {
  x: number;
  y: number;
}

/**
 * Touch- and mouse-capable canvas signature capture. Resizes to its
 * container's width (mobile-first — patients sign on their phones) and
 * scales for devicePixelRatio so strokes stay crisp. Emits a base64 PNG
 * data URI via onChange every time the drawing changes; `null` once
 * cleared, so callers can gate their "Sign" button on non-null.
 */
export function SignaturePad({
  onChange,
  disabled,
  className,
}: {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = 160;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      ctx?.scale(ratio, ratio);
      if (ctx) {
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.strokeStyle = "currentColor";
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || !drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const point = getPoint(e);
    if (ctx && lastPointRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    lastPointRef.current = point;
    if (!hasDrawn) setHasDrawn(true);
  }

  function handlePointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
    if (hasDrawn && canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
    onChange(null);
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div
        ref={containerRef}
        className={cn(
          "touch-none rounded-md border border-border bg-background text-foreground",
          disabled && "opacity-50",
        )}
      >
        <canvas
          ref={canvasRef}
          className="block h-[160px] w-full cursor-crosshair touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Sign above using your finger, stylus, or mouse.</p>
        <Button type="button" variant="ghost" size="sm" disabled={disabled || !hasDrawn} onClick={clear}>
          <Eraser className="h-3.5 w-3.5" /> Clear
        </Button>
      </div>
    </div>
  );
}
