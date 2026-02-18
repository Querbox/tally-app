import { useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore';

interface DayData {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4; // 0 = no tasks, 4 = most tasks
}

// Generate array of dates for the last N weeks
function generateDateRange(weeks: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  const daysToShow = weeks * 7;

  // Start from (daysToShow - 1) days ago
  for (let i = daysToShow - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

// Get intensity level based on count
function getLevel(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (maxCount <= 1) return count > 0 ? 2 : 0;

  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

// Color palette (GitHub-style green)
const COLORS = {
  0: 'bg-gray-100',
  1: 'bg-emerald-200',
  2: 'bg-emerald-400',
  3: 'bg-emerald-500',
  4: 'bg-emerald-600',
};

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

interface ProductivityHeatmapProps {
  weeks?: number; // Number of weeks to show (default: 12)
  className?: string;
}

export function ProductivityHeatmap({ weeks = 12, className = '' }: ProductivityHeatmapProps) {
  const tasks = useTaskStore((s) => s.tasks);

  // Calculate completed tasks per day
  const heatmapData = useMemo(() => {
    const dates = generateDateRange(weeks);

    // Count completed tasks per date
    const countsMap = new Map<string, number>();

    tasks.forEach((task) => {
      if (task.status === 'completed' && task.completedAt) {
        const completedDate = task.completedAt.split('T')[0];
        if (dates.includes(completedDate)) {
          countsMap.set(completedDate, (countsMap.get(completedDate) || 0) + 1);
        }
      }
    });

    // Find max count for level calculation
    const maxCount = Math.max(...Array.from(countsMap.values()), 1);

    // Map dates to DayData
    const data: DayData[] = dates.map((date) => {
      const count = countsMap.get(date) || 0;
      return {
        date,
        count,
        level: getLevel(count, maxCount),
      };
    });

    // Calculate total completed in this period
    const totalCompleted = Array.from(countsMap.values()).reduce((a, b) => a + b, 0);

    return { data, totalCompleted, maxCount };
  }, [tasks, weeks]);

  // Group data by weeks (columns) for grid layout
  const gridData = useMemo(() => {
    const weeksArray: DayData[][] = [];
    let currentWeek: DayData[] = [];

    // Start with empty cells until first Monday
    const firstDate = new Date(heatmapData.data[0]?.date);
    const firstDayOfWeek = firstDate.getDay(); // 0 = Sunday
    const mondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    // Add empty cells for days before first date
    for (let i = 0; i < mondayOffset; i++) {
      currentWeek.push({ date: '', count: 0, level: 0 });
    }

    heatmapData.data.forEach((day) => {
      currentWeek.push(day);

      if (currentWeek.length === 7) {
        weeksArray.push(currentWeek);
        currentWeek = [];
      }
    });

    // Add remaining days
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: '', count: 0, level: 0 });
      }
      weeksArray.push(currentWeek);
    }

    return weeksArray;
  }, [heatmapData.data]);

  // Get month labels for the grid
  const monthLabels = useMemo(() => {
    const labels: { month: string; index: number }[] = [];
    let lastMonth = -1;

    gridData.forEach((week, weekIndex) => {
      const firstValidDay = week.find((d) => d.date);
      if (firstValidDay?.date) {
        const month = new Date(firstValidDay.date).getMonth();
        if (month !== lastMonth) {
          labels.push({ month: MONTHS[month], index: weekIndex });
          lastMonth = month;
        }
      }
    });

    return labels;
  }, [gridData]);

  return (
    <div className={className}>
      {/* Summary */}
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{heatmapData.totalCompleted}</span> Aufgaben in {weeks} Wochen erledigt
        </p>
      </div>

      {/* Month Labels */}
      <div className="flex mb-1 ml-8">
        {monthLabels.map(({ month, index }, i) => {
          const nextIndex = monthLabels[i + 1]?.index ?? gridData.length;
          const width = (nextIndex - index) * 14; // 12px cell + 2px gap
          return (
            <div
              key={`${month}-${index}`}
              className="text-xs text-gray-400"
              style={{ width: `${width}px` }}
            >
              {month}
            </div>
          );
        })}
      </div>

      {/* Heatmap Grid */}
      <div className="flex">
        {/* Weekday Labels */}
        <div className="flex flex-col gap-0.5 mr-2 text-xs text-gray-400">
          {WEEKDAYS.map((day, i) => (
            <div key={day} className="h-3 flex items-center">
              {i % 2 === 0 ? day : ''}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-0.5">
          {gridData.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-0.5">
              {week.map((day, dayIndex) => (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={`w-3 h-3 rounded-sm ${day.date ? COLORS[day.level] : 'bg-transparent'} transition-colors hover:ring-1 hover:ring-gray-400`}
                  title={
                    day.date
                      ? `${new Date(day.date).toLocaleDateString('de-DE', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}: ${day.count} Aufgabe${day.count !== 1 ? 'n' : ''}`
                      : ''
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-3 text-xs text-gray-400">
        <span>Weniger</span>
        <div className="flex gap-0.5">
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <div key={level} className={`w-3 h-3 rounded-sm ${COLORS[level]}`} />
          ))}
        </div>
        <span>Mehr</span>
      </div>
    </div>
  );
}
