import { useEffect, useRef, useState, useCallback } from 'react';
import { Pencil, Eraser, Trash2, Circle, X } from 'lucide-react';
import {
  drawLine,
  drawStroke,
  clearCanvas,
  normalizeCoordinates,
  denormalizeCoordinates,
  throttle,
  type Point,
  type DrawingStroke,
  type CursorPosition,
  type DrawingMessage,
} from '../utils/drawing';

interface DrawingCanvasProps {
  isActive: boolean; // Only active when screen sharing
  isDrawingEnabled: boolean;
  onDrawingMessage: (message: DrawingMessage) => void;
  remoteDrawingMessages: DrawingMessage[];
  onDisableDrawing?: () => void; // Callback to disable drawing mode
}

export const DrawingCanvas = ({
  isActive,
  isDrawingEnabled,
  onDrawingMessage,
  remoteDrawingMessages,
  onDisableDrawing,
}: DrawingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [brushColor, setBrushColor] = useState('#FF0000');
  const [brushSize, setBrushSize] = useState(3);
  const [showControls, setShowControls] = useState(false);
  const [remoteCursor, setRemoteCursor] = useState<CursorPosition | null>(null);

  const lastPointRef = useRef<Point | null>(null);
  const strokeIdRef = useRef<number>(0);

  // Redraw all strokes when canvas is resized or strokes change
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    clearCanvas(ctx, canvas.width, canvas.height);

    // Redraw all strokes
    strokes.forEach((stroke) => {
      const denormalizedPoints = stroke.points.map((p) =>
        denormalizeCoordinates(p, canvas.width, canvas.height)
      );
      drawStroke(ctx, denormalizedPoints, stroke.color, stroke.width);
    });
  }, [strokes]);

  // Setup canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('[DrawingCanvas] Canvas ref not available');
      return;
    }

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) {
        console.warn('[DrawingCanvas] Canvas parent not available');
        return;
      }

      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      console.log('[DrawingCanvas] Canvas resized:', {
        width: canvas.width,
        height: canvas.height,
        parentWidth: parent.clientWidth,
        parentHeight: parent.clientHeight,
        parentTagName: parent.tagName,
      });

      // Warn if canvas has invalid dimensions
      if (canvas.width === 0 || canvas.height === 0) {
        console.error('[DrawingCanvas] Canvas has zero dimensions!', {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          parentWidth: parent.clientWidth,
          parentHeight: parent.clientHeight,
          parentDisplay: window.getComputedStyle(parent).display,
          parentPosition: window.getComputedStyle(parent).position,
        });
      }

      redrawCanvas();
    };

    // Initial resize with delay to ensure parent is rendered
    setTimeout(resizeCanvas, 100);
    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [redrawCanvas, isActive]);

  // Throttled cursor position sender (defined before handlePointerMove to avoid dependency issues)
  const throttledSendCursorRef = useRef<((point: Point) => void) | null>(null);

  useEffect(() => {
    throttledSendCursorRef.current = throttle((point: Point) => {
      onDrawingMessage({
        type: 'cursor',
        data: {
          x: point.x,
          y: point.y,
          timestamp: Date.now(),
        },
      });
    }, 50);
  }, [onDrawingMessage]);

  // Handle mouse/touch start
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingEnabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    console.log('[DrawingCanvas] Pointer down - starting stroke', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      isDrawingEnabled,
    });

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normalizedPoint = normalizeCoordinates(x, y, canvas.width, canvas.height);

    // Start new stroke
    const strokeId = `stroke-${Date.now()}-${strokeIdRef.current++}`;
    const newStroke: DrawingStroke = {
      id: strokeId,
      points: [normalizedPoint],
      color: brushColor,
      width: brushSize,
      timestamp: Date.now(),
    };

    setCurrentStroke(newStroke);
    setIsDrawing(true);
    lastPointRef.current = normalizedPoint;

    // Send stroke start to remote peer
    onDrawingMessage({
      type: 'stroke-start',
      data: {
        id: strokeId,
        color: brushColor,
        width: brushSize,
        point: normalizedPoint,
      },
    });
  };

  // Handle mouse/touch move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const normalizedPoint = normalizeCoordinates(x, y, canvas.width, canvas.height);

      // Send cursor position (throttled)
      if (!isDrawing && throttledSendCursorRef.current) {
        throttledSendCursorRef.current(normalizedPoint);
      }

      // Continue drawing stroke
      if (isDrawing && currentStroke && lastPointRef.current) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw line from last point to current point
        const lastPixelPoint = denormalizeCoordinates(
          lastPointRef.current,
          canvas.width,
          canvas.height
        );
        const currentPixelPoint = denormalizeCoordinates(
          normalizedPoint,
          canvas.width,
          canvas.height
        );

        drawLine(ctx, lastPixelPoint, currentPixelPoint, brushColor, brushSize);

        // Update stroke
        const updatedStroke = {
          ...currentStroke,
          points: [...currentStroke.points, normalizedPoint],
        };
        setCurrentStroke(updatedStroke);
        lastPointRef.current = normalizedPoint;

        // Send point to remote peer
        onDrawingMessage({
          type: 'stroke-point',
          data: {
            id: currentStroke.id,
            point: normalizedPoint,
          },
        });
      }
    },
    [isDrawing, currentStroke, brushColor, brushSize, onDrawingMessage]
  );

  // Handle mouse/touch end
  const handlePointerUp = () => {
    if (!isDrawing || !currentStroke) return;

    // Save stroke
    setStrokes((prev) => [...prev, currentStroke]);
    setIsDrawing(false);
    setCurrentStroke(null);
    lastPointRef.current = null;

    // Send stroke end to remote peer
    onDrawingMessage({
      type: 'stroke-end',
      data: { id: currentStroke.id },
    });
  };

  // Clear all drawings
  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke(null);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        clearCanvas(ctx, canvas.width, canvas.height);
      }
    }

    // Send clear to remote peer
    onDrawingMessage({ type: 'clear-all' });
  };

  // Handle remote drawing messages
  useEffect(() => {
    if (remoteDrawingMessages.length === 0) return;

    const latestMessage = remoteDrawingMessages[remoteDrawingMessages.length - 1];
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    switch (latestMessage.type) {
      case 'stroke-start': {
        // Remote peer started a new stroke
        const { id, color, width, point } = latestMessage.data;
        const newStroke: DrawingStroke = {
          id,
          points: [point],
          color,
          width,
          timestamp: Date.now(),
        };
        setStrokes((prev) => [...prev, newStroke]);
        break;
      }

      case 'stroke-point': {
        // Remote peer added points to existing stroke
        const { id, point } = latestMessage.data;
        setStrokes((prev) =>
          prev.map((stroke) =>
            stroke.id === id
              ? { ...stroke, points: [...stroke.points, point] }
              : stroke
          )
        );

        // Draw the new line segment
        const stroke = strokes.find((s) => s.id === id);
        if (stroke && stroke.points.length > 0) {
          const lastPoint = stroke.points[stroke.points.length - 1];
          const lastPixel = denormalizeCoordinates(lastPoint, canvas.width, canvas.height);
          const currentPixel = denormalizeCoordinates(point, canvas.width, canvas.height);
          drawLine(ctx, lastPixel, currentPixel, stroke.color, stroke.width);
        }
        break;
      }

      case 'stroke-end': {
        // Remote peer finished stroke (already in strokes array)
        redrawCanvas();
        break;
      }

      case 'cursor': {
        // Remote peer moved cursor
        const cursorData = latestMessage.data;
        setRemoteCursor({ x: cursorData.x, y: cursorData.y, timestamp: cursorData.timestamp });
        break;
      }

      case 'clear-all': {
        // Remote peer cleared all drawings
        setStrokes([]);
        setCurrentStroke(null);
        clearCanvas(ctx, canvas.width, canvas.height);
        break;
      }
    }
  }, [remoteDrawingMessages, strokes, redrawCanvas]);

  if (!isActive) return null;

  return (
    <>
      {/* Drawing Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-40 ${isDrawingEnabled ? 'cursor-crosshair' : 'pointer-events-none'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          touchAction: 'none',
          // Ensure canvas is visible during debugging
          border: isDrawingEnabled ? '2px solid rgba(255,0,0,0.3)' : 'none'
        }}
      />

      {/* Remote Cursor */}
      {remoteCursor && !isDrawingEnabled && (
        <div
          className="absolute z-50 pointer-events-none transition-all duration-75"
          style={{
            left: `${remoteCursor.x * 100}%`,
            top: `${remoteCursor.y * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="w-4 h-4 bg-primary-500 rounded-full border-2 border-white shadow-lg" />
        </div>
      )}

      {/* Drawing Controls */}
      {isDrawingEnabled && (
        <div className="absolute bottom-4 right-4 z-50">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-modal p-3 flex flex-col gap-2">
            {/* Header with Toggle and Close buttons */}
            <div className="flex gap-2">
              {/* Toggle Controls Button */}
              <button
                onClick={() => setShowControls(!showControls)}
                className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 transition-colors"
                title={showControls ? "Hide controls" : "Show controls"}
              >
                <Pencil className="w-5 h-5" />
              </button>

              {/* Close Drawing Mode Button */}
              {onDisableDrawing && (
                <button
                  onClick={onDisableDrawing}
                  className="w-10 h-10 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center hover:bg-neutral-300 transition-colors"
                  title="Exit drawing mode"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Expanded Controls */}
            {showControls && (
              <>
                {/* Color Picker */}
                <div className="flex gap-2 flex-wrap max-w-[120px]">
                  {['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#000000', '#FFFFFF'].map(
                    (color) => (
                      <button
                        key={color}
                        onClick={() => setBrushColor(color)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          brushColor === color ? 'border-primary-500 scale-110' : 'border-neutral-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    )
                  )}
                </div>

                {/* Brush Size */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-neutral-700 font-medium">Size</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>Thin</span>
                    <span>Thick</span>
                  </div>
                </div>

                {/* Clear Button */}
                <button
                  onClick={handleClear}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-error text-white rounded-md hover:bg-error/90 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Clear All</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
