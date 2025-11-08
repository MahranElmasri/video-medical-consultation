import { memo } from 'react';

interface AudioLevelIndicatorProps {
  level: number; // 0-100
  isLocal?: boolean; // Different styling for local vs remote
}

const AudioLevelIndicatorComponent = ({ level, isLocal = false }: AudioLevelIndicatorProps) => {
  // Calculate how many bars should be lit based on level
  const numBars = 8;
  const activeBars = Math.ceil((level / 100) * numBars);

  // Determine color based on level
  const getBarColor = (barIndex: number) => {
    if (barIndex >= activeBars) {
      return 'bg-neutral-700/50'; // Inactive bar
    }

    // Active bars - gradient from green to yellow to red
    if (barIndex < numBars * 0.6) {
      return 'bg-success'; // Green for low-medium levels
    } else if (barIndex < numBars * 0.8) {
      return 'bg-warning'; // Yellow for medium-high levels
    } else {
      return 'bg-error'; // Red for high levels
    }
  };

  return (
    <div className={`flex gap-1 ${isLocal ? 'flex-row' : 'flex-row'} items-end`}>
      {Array.from({ length: numBars }).map((_, index) => (
        <div
          key={index}
          className={`transition-all duration-100 ${getBarColor(index)} rounded-sm`}
          style={{
            width: isLocal ? '3px' : '4px',
            height: isLocal ? `${8 + index * 2}px` : `${10 + index * 3}px`,
            opacity: index < activeBars ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
export const AudioLevelIndicator = memo(AudioLevelIndicatorComponent, (prev, next) => {
  // Only re-render if level changes by more than 5 points (reduce flicker)
  return Math.abs(prev.level - next.level) < 5 && prev.isLocal === next.isLocal;
});
