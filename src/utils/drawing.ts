/**
 * Drawing and annotation utilities for screen sharing
 */

export interface Point {
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  timestamp: number;
}

export interface CursorPosition {
  x: number;
  y: number;
  timestamp: number;
}

export type DrawingMessage =
  | { type: 'cursor'; data: CursorPosition }
  | { type: 'stroke-start'; data: { id: string; color: string; width: number; point: Point } }
  | { type: 'stroke-point'; data: { id: string; point: Point } }
  | { type: 'stroke-end'; data: { id: string } }
  | { type: 'clear-all' };

/**
 * Draw a smooth line between two points on a canvas
 */
export const drawLine = (
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
  width: number
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
};

/**
 * Draw a smooth stroke (series of connected points)
 */
export const drawStroke = (
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  width: number
) => {
  if (points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  // Use quadratic curves for smoother lines
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }

  // Draw last point
  const lastPoint = points[points.length - 1];
  ctx.lineTo(lastPoint.x, lastPoint.y);
  ctx.stroke();
};

/**
 * Clear the entire canvas
 */
export const clearCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.clearRect(0, 0, width, height);
};

/**
 * Convert mouse event to normalized coordinates (0-1 range)
 * This allows coordinates to work across different screen sizes
 */
export const normalizeCoordinates = (
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number
): Point => {
  return {
    x: x / containerWidth,
    y: y / containerHeight,
  };
};

/**
 * Convert normalized coordinates back to pixel coordinates
 */
export const denormalizeCoordinates = (
  normalizedPoint: Point,
  containerWidth: number,
  containerHeight: number
): Point => {
  return {
    x: normalizedPoint.x * containerWidth,
    y: normalizedPoint.y * containerHeight,
  };
};

/**
 * Throttle function to limit how often events are sent
 */
export const throttle = <T extends (...args: any[]) => void>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
