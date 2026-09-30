import React from 'react';
import { contentGuardConfig } from '../../hooks/useContentGuard';

export interface WatermarkProps {
  text?: string;
  opacity?: number;
  angle?: number;
  fontSize?: number;
  color?: string;
  className?: string;
}

/**
 * Subtle repeating diagonal SVG watermark overlay.
 * Note: Watermarking is the only client-side technique that persists through OS-level screenshots.
 */
export const Watermark: React.FC<WatermarkProps> = ({
  text = contentGuardConfig.watermarkText,
  opacity = 0.07,
  angle = -25,
  fontSize = 13,
  color = '#ffffff',
  className = '',
}) => {
  const svgPattern = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="140">
      <text x="50%" y="50%" fill="${color}" opacity="${opacity}" font-size="${fontSize}px" font-family="system-ui, -apple-system, sans-serif" font-weight="600" text-anchor="middle" transform="rotate(${angle} 140 70)">${text}</text>
    </svg>`
  );

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,${svgPattern}")`,
        backgroundRepeat: 'repeat',
        zIndex: 10,
        userSelect: 'none',
      }}
    />
  );
};

export default Watermark;
