import { useState, useEffect } from "react";

interface LoadingIndicatorProps {
  className?: string;
}

const styles = [
  // Ripple effect
  {
    id: 'ripple',
    svg: `<svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="4">
        <animate attributeName="r" from="20" to="40" dur="1.5s" begin="0s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="1" to="0" dur="1.5s" begin="0s" repeatCount="indefinite"/>
      </circle>
      <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="4">
        <animate attributeName="r" from="20" to="40" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="1" to="0" dur="1.5s" begin="0.5s" repeatCount="indefinite"/>
      </circle>
    </svg>`
  },
  // Pulse dots
  {
    id: 'dots',
    svg: `<svg viewBox="0 0 100 100">
      <circle cx="30" cy="50" r="6" fill="currentColor">
        <animate attributeName="opacity" from="1" to="0.2" dur="0.8s" begin="0s" repeatCount="indefinite"/>
      </circle>
      <circle cx="50" cy="50" r="6" fill="currentColor">
        <animate attributeName="opacity" from="1" to="0.2" dur="0.8s" begin="0.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="70" cy="50" r="6" fill="currentColor">
        <animate attributeName="opacity" from="1" to="0.2" dur="0.8s" begin="0.4s" repeatCount="indefinite"/>
      </circle>
    </svg>`
  },
  // Rotating segments
  {
    id: 'segments',
    svg: `<svg viewBox="0 0 100 100">
      <g>
        <rect x="45" y="10" width="10" height="25" rx="5" fill="currentColor">
          <animate attributeName="opacity" from="1" to="0.2" dur="1s" begin="0s" repeatCount="indefinite"/>
        </rect>
        <animateTransform 
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="2s"
          repeatCount="indefinite"
        />
      </g>
      <g>
        <rect x="45" y="10" width="10" height="25" rx="5" fill="currentColor">
          <animate attributeName="opacity" from="1" to="0.2" dur="1s" begin="0.2s" repeatCount="indefinite"/>
        </rect>
        <animateTransform 
          attributeName="transform"
          type="rotate"
          from="72 50 50"
          to="432 50 50"
          dur="2s"
          repeatCount="indefinite"
        />
      </g>
      <g>
        <rect x="45" y="10" width="10" height="25" rx="5" fill="currentColor">
          <animate attributeName="opacity" from="1" to="0.2" dur="1s" begin="0.4s" repeatCount="indefinite"/>
        </rect>
        <animateTransform 
          attributeName="transform"
          type="rotate"
          from="144 50 50"
          to="504 50 50"
          dur="2s"
          repeatCount="indefinite"
        />
      </g>
    </svg>`
  }
];

export function LoadingIndicator({ className = "" }: LoadingIndicatorProps) {
  const [currentStyleIndex, setCurrentStyleIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStyleIndex((prev) => (prev + 1) % styles.length);
    }, 2000); // Change style every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const currentStyle = styles[currentStyleIndex];

  return (
    <div 
      className={`w-12 h-12 text-primary ${className}`}
      dangerouslySetInnerHTML={{ __html: currentStyle.svg }}
    />
  );
}
