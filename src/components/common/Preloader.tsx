import React, { useEffect, useState } from 'react';
import styles from './Preloader.module.css';

interface PreloaderProps {
  onComplete?: () => void;
  durationMs?: number;
}

export const Preloader: React.FC<PreloaderProps> = ({
  onComplete,
  durationMs = 0,
}) => {
  const [progress, setProgress] = useState(100);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isHidden, setIsHidden] = useState(true);

  const brandName = "SOUNDABODE";

  useEffect(() => {
    if (isHidden) {
      if (onComplete) onComplete();
      return;
    }

    try {
      sessionStorage.setItem('sa_preloader_seen', 'true');
    } catch {
      // ignore storage errors
    }

    document.body.style.overflow = 'hidden';

    let startTime = performance.now();
    let animationFrameId: number;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;

    const updateProgress = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const calculatedProgress = Math.min(
        Math.floor((elapsedTime / durationMs) * 100),
        100
      );

      setProgress(calculatedProgress);

      if (calculatedProgress < 100) {
        animationFrameId = requestAnimationFrame(updateProgress);
      } else {
        t1 = setTimeout(() => {
          setIsFadingOut(true);
          t2 = setTimeout(() => {
            setIsHidden(true);
            document.body.style.overflow = '';
            if (onComplete) onComplete();
          }, 100);
        }, 50);
      }
    };

    animationFrameId = requestAnimationFrame(updateProgress);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(t1);
      clearTimeout(t2);
      document.body.style.overflow = '';
    };
  }, [durationMs, onComplete]);

  if (isHidden) return null;

  return (
    <div className={`${styles.preloaderOverlay} ${isFadingOut ? styles.fadeOut : ''}`}>
      <div className={styles.logoWrapper}>
        <div className={styles.logoText}>
          {brandName.split('').map((char, index) => {
            const totalChars = brandName.length;
            const charStartProgress = (index / totalChars) * 100;
            const charEndProgress = ((index + 1) / totalChars) * 100;

            let charFillPercent = 0;
            if (progress >= charEndProgress) {
              charFillPercent = 100;
            } else if (progress > charStartProgress) {
              charFillPercent =
                ((progress - charStartProgress) / (charEndProgress - charStartProgress)) *
                100;
            }

            return (
              <div key={index} className={styles.letter}>
                {char}
                <div
                  className={styles.letterFilled}
                  style={{ width: `${charFillPercent}%` }}
                >
                  {char}
                </div>
              </div>
            );
          })}
        </div>
        {/* Stencil cutout lines overlay */}
        <div className={styles.stencilOverlay} />
      </div>
    </div>
  );
};

export default Preloader;
