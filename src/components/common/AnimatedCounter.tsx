import React, { useEffect, useState, useRef } from 'react';

export interface AnimatedCounterProps {
  end: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  end,
  duration = 2000,
  suffix = '',
  prefix = '',
}) => {
  const [count, setCount] = useState(0);
  const nodeRef = useRef<HTMLSpanElement>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    let animationFrameId: number;

    const startAnimation = () => {
      if (hasAnimatedRef.current) return;
      hasAnimatedRef.current = true;

      let startTime: number | null = null;

      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        // Cubic ease-out curve for smooth deceleration
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentCount = Math.floor(easeProgress * end);
        setCount(currentCount);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step);
        } else {
          setCount(end);
        }
      };

      animationFrameId = requestAnimationFrame(step);
    };

    if (typeof IntersectionObserver === 'undefined') {
      startAnimation();
      return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startAnimation();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [end, duration]);

  return (
    <span ref={nodeRef}>
      {prefix}
      {count}
      {suffix}
    </span>
  );
};

export default AnimatedCounter;
