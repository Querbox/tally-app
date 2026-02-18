import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTaskStore } from '../stores/taskStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatDuration } from '../utils/timeUtils';
import { getTodayString, addDays } from '../utils/dateUtils';
import {
  X,
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
  Users,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  PieChart,
  Activity,
  Grid3X3,
  Repeat,
  ListTodo,
  Zap,
} from 'lucide-react';
import { ProductivityHeatmap } from '../components/stats/ProductivityHeatmap';
import { DetailedAnalytics } from '../components/expert/DetailedAnalytics';

interface StatsViewProps {
  onClose: () => void;
}

type TimeRange = 'week' | 'month' | 'year';
type ChartType = 'bar' | 'area';

// Tooltip component
function Tooltip({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    setPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onMouseMove={handleMouseMove}
      className="relative"
    >
      {children}
      {show && createPortal(
        <div
          className="fixed z-[9999] bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ left: position.x, top: position.y - 10 }}
        >
          {content}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>,
        document.body
      )}
    </div>
  );
}

// Animated counter
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  return (
    <span className="tabular-nums">
      {value.toLocaleString('de-DE')}{suffix}
    </span>
  );
}

// Donut Chart Component
function DonutChart({ data, size = 120 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="text-gray-300 text-sm">Keine Daten</div>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {data.map((item, index) => {
          const percentage = item.value / total;
          const strokeLength = percentage * circumference;
          const offset = currentOffset;
          currentOffset += strokeLength;

          return (
            <Tooltip key={index} content={<span>{item.label}: {item.value} ({(percentage * 100).toFixed(0)}%)</span>}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="16"
                strokeDasharray={`${strokeLength} ${circumference}`}
                strokeDashoffset={-offset}
                className="transition-all duration-700 ease-out cursor-pointer hover:opacity-80"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
              />
            </Tooltip>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{total}</span>
        <span className="text-xs text-gray-500">Gesamt</span>
      </div>
    </div>
  );
}

// Mini Sparkline
function Sparkline({ data, color = '#111' }: { data: number[]; color?: string }) {
  if (data.length === 0) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 80;
  const height = 24;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500"
      />
      {/* End dot */}
      {data.length > 0 && (
        <circle
          cx={width - padding}
          cy={height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)}
          r="3"
          fill={color}
          className="animate-pulse"
        />
      )}
    </svg>
  );
}

export function StatsView({ onClose }: StatsViewProps) {
  const tasks = useTaskStore((s) => s.tasks);
  const clients = useTaskStore((s) => s.clients);
  const dayHistory = useSettingsStore((s) => s.dayHistory);
  const expertModeSettings = useSettingsStore((s) => s.expertModeSettings);

  const showDetailedAnalytics = expertModeSettings?.enabled && expertModeSettings?.detailedAnalytics;

  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const today = getTodayString();

  // Calculate date ranges
  const dateRanges = useMemo(() => {
    let startDate: string;
    let prevStartDate: string;
    let prevEndDate: string;

    switch (timeRange) {
      case 'week':
        startDate = addDays(today, -6);
        prevStartDate = addDays(today, -13);
        prevEndDate = addDays(today, -7);
        break;
      case 'month':
        startDate = addDays(today, -29);
        prevStartDate = addDays(today, -59);
        prevEndDate = addDays(today, -30);
        break;
      case 'year':
        startDate = addDays(today, -364);
        prevStartDate = addDays(today, -729);
        prevEndDate = addDays(today, -365);
        break;
    }

    return { startDate, prevStartDate, prevEndDate, endDate: today };
  }, [today, timeRange]);

  // Current period stats
  const currentStats = useMemo(() => {
    const periodTasks = tasks.filter(
      (t) => t.scheduledDate >= dateRanges.startDate && t.scheduledDate <= dateRanges.endDate
    );

    const completedTasks = periodTasks.filter((t) => t.status === 'completed' && !t.isMeeting);
    const totalTasks = periodTasks.filter((t) => !t.isMeeting);
    const inProgressTasks = periodTasks.filter((t) => t.status === 'in_progress' && !t.isMeeting);
    const todoTasks = periodTasks.filter((t) => t.status === 'todo' && !t.isMeeting);

    const totalTime = periodTasks.reduce((acc, task) => {
      return acc + task.timeEntries.reduce((t, e) => t + (e.duration || 0), 0);
    }, 0);

    const avgTasksPerDay = totalTasks.length / (timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365);

    // Work days from history
    const workDays = dayHistory.filter(
      (d) => d.date >= dateRanges.startDate && d.date <= dateRanges.endDate
    );

    // Calculate regularity (days with completed tasks in period)
    const daysWithActivity = new Set(
      completedTasks.map((t) => t.scheduledDate)
    ).size;
    const totalDaysInPeriod = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
    const regularityRate = (daysWithActivity / totalDaysInPeriod) * 100;

    return {
      completed: completedTasks.length,
      inProgress: inProgressTasks.length,
      todo: todoTasks.length,
      total: totalTasks.length,
      completionRate: totalTasks.length > 0 ? (completedTasks.length / totalTasks.length) * 100 : 0,
      totalTime,
      avgTasksPerDay,
      workDays: workDays.length,
      daysWithActivity,
      regularityRate,
      totalDaysInPeriod,
    };
  }, [tasks, dateRanges, dayHistory, timeRange, today]);

  // Previous period stats for comparison
  const previousStats = useMemo(() => {
    const periodTasks = tasks.filter(
      (t) => t.scheduledDate >= dateRanges.prevStartDate && t.scheduledDate <= dateRanges.prevEndDate
    );

    const completedTasks = periodTasks.filter((t) => t.status === 'completed' && !t.isMeeting);
    const totalTasks = periodTasks.filter((t) => !t.isMeeting);

    const totalTime = periodTasks.reduce((acc, task) => {
      return acc + task.timeEntries.reduce((t, e) => t + (e.duration || 0), 0);
    }, 0);

    return {
      completed: completedTasks.length,
      total: totalTasks.length,
      completionRate: totalTasks.length > 0 ? (completedTasks.length / totalTasks.length) * 100 : 0,
      totalTime,
    };
  }, [tasks, dateRanges]);

  // Client stats
  const clientStats = useMemo(() => {
    const periodTasks = tasks.filter(
      (t) =>
        t.scheduledDate >= dateRanges.startDate &&
        t.scheduledDate <= dateRanges.endDate &&
        t.clientId
    );

    const clientMap = new Map<string, { tasks: number; time: number; completed: number }>();

    periodTasks.forEach((task) => {
      if (!task.clientId) return;
      const existing = clientMap.get(task.clientId) || { tasks: 0, time: 0, completed: 0 };
      const taskTime = task.timeEntries.reduce((t, e) => t + (e.duration || 0), 0);
      clientMap.set(task.clientId, {
        tasks: existing.tasks + 1,
        time: existing.time + taskTime,
        completed: existing.completed + (task.status === 'completed' ? 1 : 0),
      });
    });

    return Array.from(clientMap.entries())
      .map(([clientId, stats]) => {
        const client = clients.find((c) => c.id === clientId);
        return {
          client,
          ...stats,
        };
      })
      .filter((s) => s.client)
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);
  }, [tasks, clients, dateRanges]);

  // Daily breakdown for chart
  const dailyData = useMemo(() => {
    const days: { date: string; fullDate: string; completed: number; total: number; time: number }[] = [];
    const dayCount = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 12;

    if (timeRange === 'year') {
      // Group by month
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(today);
        monthStart.setMonth(monthStart.getMonth() - i);
        monthStart.setDate(1);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0);

        const monthStartStr = monthStart.toISOString().split('T')[0];
        const monthEndStr = monthEnd.toISOString().split('T')[0];

        const monthTasks = tasks.filter(
          (t) => t.scheduledDate >= monthStartStr && t.scheduledDate <= monthEndStr && !t.isMeeting
        );

        const time = monthTasks.reduce((acc, task) => {
          return acc + task.timeEntries.reduce((t, e) => t + (e.duration || 0), 0);
        }, 0);

        days.push({
          date: monthStart.toLocaleDateString('de-DE', { month: 'short' }),
          fullDate: monthStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
          completed: monthTasks.filter((t) => t.status === 'completed').length,
          total: monthTasks.length,
          time,
        });
      }
    } else {
      for (let i = dayCount - 1; i >= 0; i--) {
        const date = addDays(today, -i);
        const dayTasks = tasks.filter((t) => t.scheduledDate === date && !t.isMeeting);

        const time = dayTasks.reduce((acc, task) => {
          return acc + task.timeEntries.reduce((t, e) => t + (e.duration || 0), 0);
        }, 0);

        days.push({
          date: new Date(date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' }),
          fullDate: new Date(date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
          completed: dayTasks.filter((t) => t.status === 'completed').length,
          total: dayTasks.length,
          time,
        });
      }
    }

    return days;
  }, [tasks, today, timeRange]);

  const maxTasks = Math.max(...dailyData.map((d) => d.total), 1);

  // Sparkline data
  const sparklineData = useMemo(() => {
    return dailyData.map(d => d.completed);
  }, [dailyData]);

  // Trend indicator
  const getTrend = (current: number, previous: number) => {
    const diff = current - previous;
    const percentage = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

    if (diff > 0) return { icon: ArrowUp, color: 'text-green-500', bgColor: 'bg-green-50', label: `+${percentage.toFixed(0)}%` };
    if (diff < 0) return { icon: ArrowDown, color: 'text-red-500', bgColor: 'bg-red-50', label: `${percentage.toFixed(0)}%` };
    return { icon: Minus, color: 'text-gray-400', bgColor: 'bg-gray-50', label: '0%' };
  };

  const completedTrend = getTrend(currentStats.completed, previousStats.completed);
  const timeTrend = getTrend(currentStats.totalTime, previousStats.totalTime);
  const rateTrend = getTrend(currentStats.completionRate, previousStats.completionRate);

  // Task status distribution for donut chart
  const statusData = [
    { label: 'Erledigt', value: currentStats.completed, color: '#10b981' },
    { label: 'In Arbeit', value: currentStats.inProgress, color: '#3b82f6' },
    { label: 'Offen', value: currentStats.todo, color: '#e5e7eb' },
  ];

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Statistiken</h2>
              <p className="text-sm text-gray-500">Deine Arbeitsübersicht</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Time Range Selector */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              {(['week', 'month', 'year'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    timeRange === range
                      ? 'bg-gray-900 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {range === 'week' ? '7 Tage' : range === 'month' ? '30 Tage' : '12 Monate'}
                </button>
              ))}
            </div>

            {/* Period summary - neutral, factual */}
            <div className="text-sm text-gray-500">
              {currentStats.total} Aufgaben · {formatDuration(currentStats.totalTime)} erfasst
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {/* Completed Tasks */}
            <Tooltip content={<span>Vergleich zum vorherigen Zeitraum: {previousStats.completed} erledigt</span>}>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100 hover:shadow-lg transition-all cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-green-600">Erledigt</span>
                  </div>
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${completedTrend.bgColor}`}>
                    <completedTrend.icon className={`w-3 h-3 ${completedTrend.color}`} />
                    <span className={`text-xs font-medium ${completedTrend.color}`}>{completedTrend.label}</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  <AnimatedNumber value={currentStats.completed} />
                </div>
                <div className="mt-2">
                  <Sparkline data={sparklineData} color="#10b981" />
                </div>
              </div>
            </Tooltip>

            {/* Completion Rate - renamed to more neutral term */}
            <Tooltip content={<span>{currentStats.completed} von {currentStats.total} Aufgaben erledigt</span>}>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100 hover:shadow-lg transition-all cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-600">Abschlussquote</span>
                  </div>
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${rateTrend.bgColor}`}>
                    <rateTrend.icon className={`w-3 h-3 ${rateTrend.color}`} />
                    <span className={`text-xs font-medium ${rateTrend.color}`}>{rateTrend.label}</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  <AnimatedNumber value={Math.round(currentStats.completionRate)} suffix="%" />
                </div>
                <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                    style={{ width: `${currentStats.completionRate}%` }}
                  />
                </div>
              </div>
            </Tooltip>

            {/* Total Time */}
            <Tooltip content={<span>Vorheriger Zeitraum: {formatDuration(previousStats.totalTime)}</span>}>
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-4 border border-purple-100 hover:shadow-lg transition-all cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-600">Arbeitszeit</span>
                  </div>
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${timeTrend.bgColor}`}>
                    <timeTrend.icon className={`w-3 h-3 ${timeTrend.color}`} />
                    <span className={`text-xs font-medium ${timeTrend.color}`}>{timeTrend.label}</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {formatDuration(currentStats.totalTime)}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Ø {formatDuration(Math.round(currentStats.totalTime / Math.max(currentStats.workDays, 1)))}/Tag
                </div>
              </div>
            </Tooltip>

            {/* Regularity - replaces gamified streak */}
            <Tooltip content={<span>{currentStats.daysWithActivity} von {currentStats.totalDaysInPeriod} Tagen mit erledigten Aufgaben</span>}>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100 hover:shadow-lg transition-all cursor-default">
                <div className="flex items-center gap-2 mb-2">
                  <Repeat className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-medium text-orange-600">Regelmäßigkeit</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  <AnimatedNumber value={currentStats.daysWithActivity} />
                  <span className="text-lg font-normal text-gray-400">/{currentStats.totalDaysInPeriod}</span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Tage mit Aktivität
                </div>
              </div>
            </Tooltip>

            {/* Work Days */}
            <Tooltip content={<span>Tage an denen der Arbeitstag gestartet wurde</span>}>
              <div className="bg-gradient-to-br from-cyan-50 to-teal-50 rounded-2xl p-4 border border-cyan-100 hover:shadow-lg transition-all cursor-default">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-cyan-600" />
                  <span className="text-xs font-medium text-cyan-600">Arbeitstage</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  <AnimatedNumber value={currentStats.workDays} />
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Ø {currentStats.avgTasksPerDay.toFixed(1)} Aufgaben/Tag
                </div>
              </div>
            </Tooltip>
          </div>

          {/* Productivity Heatmap - Central Element */}
          <div className="mb-6">
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Grid3X3 className="w-4 h-4 text-gray-600" />
                <h3 className="font-medium text-gray-900">Aktivitäts-Heatmap</h3>
                <span className="text-xs text-gray-400 ml-auto">Letzte 12 Wochen</span>
              </div>
              <ProductivityHeatmap weeks={12} />
            </div>
          </div>

          {/* Period Comparison - factual, no judgment */}
          <div className="mb-6">
            <div className="bg-white rounded-2xl p-5 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-gray-600" />
                <h3 className="font-medium text-gray-900">Vergleich zum Vorperiode</h3>
                <span className="text-xs text-gray-400 ml-auto">
                  {timeRange === 'week' ? 'vs. letzte 7 Tage' : timeRange === 'month' ? 'vs. letzte 30 Tage' : 'vs. letzte 12 Monate'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Completed comparison */}
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-500 mb-1">Aufgaben erledigt</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl font-semibold text-gray-900">{currentStats.completed}</span>
                    <span className="text-sm text-gray-400">vs.</span>
                    <span className="text-lg text-gray-500">{previousStats.completed}</span>
                  </div>
                  <div className={`text-xs mt-1 flex items-center justify-center gap-1 ${
                    currentStats.completed > previousStats.completed ? 'text-gray-600' :
                    currentStats.completed < previousStats.completed ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {currentStats.completed > previousStats.completed && <ArrowUp className="w-3 h-3" />}
                    {currentStats.completed < previousStats.completed && <ArrowDown className="w-3 h-3" />}
                    {currentStats.completed === previousStats.completed && <Minus className="w-3 h-3" />}
                    {Math.abs(currentStats.completed - previousStats.completed)} Differenz
                  </div>
                </div>

                {/* Time comparison */}
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-500 mb-1">Erfasste Zeit</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl font-semibold text-gray-900">{formatDuration(currentStats.totalTime)}</span>
                    <span className="text-sm text-gray-400">vs.</span>
                    <span className="text-lg text-gray-500">{formatDuration(previousStats.totalTime)}</span>
                  </div>
                  <div className={`text-xs mt-1 flex items-center justify-center gap-1 text-gray-600`}>
                    {currentStats.totalTime > previousStats.totalTime && <ArrowUp className="w-3 h-3" />}
                    {currentStats.totalTime < previousStats.totalTime && <ArrowDown className="w-3 h-3" />}
                    {currentStats.totalTime === previousStats.totalTime && <Minus className="w-3 h-3" />}
                    {formatDuration(Math.abs(currentStats.totalTime - previousStats.totalTime))}
                  </div>
                </div>

                {/* Rate comparison */}
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-xs text-gray-500 mb-1">Abschlussquote</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl font-semibold text-gray-900">{Math.round(currentStats.completionRate)}%</span>
                    <span className="text-sm text-gray-400">vs.</span>
                    <span className="text-lg text-gray-500">{Math.round(previousStats.completionRate)}%</span>
                  </div>
                  <div className={`text-xs mt-1 flex items-center justify-center gap-1 text-gray-600`}>
                    {currentStats.completionRate > previousStats.completionRate && <ArrowUp className="w-3 h-3" />}
                    {currentStats.completionRate < previousStats.completionRate && <ArrowDown className="w-3 h-3" />}
                    {currentStats.completionRate === previousStats.completionRate && <Minus className="w-3 h-3" />}
                    {Math.abs(Math.round(currentStats.completionRate - previousStats.completionRate))} Prozentpunkte
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Activity Chart */}
            <div className="md:col-span-2 bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-600" />
                  <h3 className="font-medium text-gray-900">Aktivität</h3>
                </div>
                <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
                  <button
                    onClick={() => setChartType('bar')}
                    className={`p-1.5 rounded transition-all ${chartType === 'bar' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setChartType('area')}
                    className={`p-1.5 rounded transition-all ${chartType === 'area' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {chartType === 'bar' ? (
                <div className="flex items-end gap-1 h-44">
                  {dailyData.map((day, index) => {
                    const isHovered = hoveredBar === index;
                    return (
                      <Tooltip
                        key={index}
                        content={
                          <div className="text-center">
                            <div className="font-medium">{day.fullDate}</div>
                            <div className="text-green-400">{day.completed} erledigt</div>
                            <div className="text-gray-400">{day.total - day.completed} offen</div>
                            {day.time > 0 && <div className="text-purple-400">{formatDuration(day.time)}</div>}
                          </div>
                        }
                      >
                        <div
                          className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
                          onMouseEnter={() => setHoveredBar(index)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          <div
                            className={`w-full flex flex-col gap-0.5 transition-all duration-200 ${isHovered ? 'scale-105' : ''}`}
                            style={{ height: '130px' }}
                          >
                            {/* Completed bar */}
                            <div
                              className={`w-full rounded-t transition-all duration-500 ${isHovered ? 'bg-green-500' : 'bg-gray-900'}`}
                              style={{
                                height: `${(day.completed / maxTasks) * 100}%`,
                                minHeight: day.completed > 0 ? '4px' : '0',
                              }}
                            />
                            {/* Remaining bar */}
                            <div
                              className={`w-full rounded-b transition-all duration-500 ${isHovered ? 'bg-gray-300' : 'bg-gray-200'}`}
                              style={{
                                height: `${((day.total - day.completed) / maxTasks) * 100}%`,
                                minHeight: day.total - day.completed > 0 ? '4px' : '0',
                              }}
                            />
                          </div>
                          <span className={`text-[10px] whitespace-nowrap overflow-hidden text-ellipsis max-w-full transition-colors ${isHovered ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                            {day.date}
                          </span>
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>
              ) : (
                <div className="h-44 relative">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${dailyData.length * 30} 130`}>
                    {/* Area */}
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`M0,130 ${dailyData.map((d, i) => `L${i * 30 + 15},${130 - (d.completed / maxTasks) * 120}`).join(' ')} L${(dailyData.length - 1) * 30 + 15},130 Z`}
                      fill="url(#areaGradient)"
                      className="transition-all duration-700"
                    />
                    {/* Line */}
                    <path
                      d={`M${15},${130 - (dailyData[0]?.completed || 0) / maxTasks * 120} ${dailyData.map((d, i) => `L${i * 30 + 15},${130 - (d.completed / maxTasks) * 120}`).join(' ')}`}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-700"
                    />
                    {/* Dots */}
                    {dailyData.map((d, i) => (
                      <Tooltip
                        key={i}
                        content={
                          <div className="text-center">
                            <div className="font-medium">{d.fullDate}</div>
                            <div className="text-green-400">{d.completed} erledigt</div>
                          </div>
                        }
                      >
                        <circle
                          cx={i * 30 + 15}
                          cy={130 - (d.completed / maxTasks) * 120}
                          r="5"
                          fill="white"
                          stroke="#10b981"
                          strokeWidth="2"
                          className="cursor-pointer hover:r-6 transition-all"
                        />
                      </Tooltip>
                    ))}
                  </svg>
                  {/* X-axis labels */}
                  <div className="flex justify-between mt-2 px-2">
                    {dailyData.filter((_, i) => i % Math.ceil(dailyData.length / 7) === 0).map((d, i) => (
                      <span key={i} className="text-[10px] text-gray-400">{d.date}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-900 rounded" />
                  <span className="text-xs text-gray-500">Erledigt</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-200 rounded" />
                  <span className="text-xs text-gray-500">Offen</span>
                </div>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-gray-600" />
                <h3 className="font-medium text-gray-900">Verteilung</h3>
              </div>

              <div className="flex flex-col items-center">
                <DonutChart data={statusData} size={140} />

                <div className="mt-4 w-full space-y-2">
                  {statusData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-gray-600">{item.label}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Client Breakdown - no gamification */}
          {clientStats.length > 0 && (
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-600" />
                  <h3 className="font-medium text-gray-900">Zeitverteilung nach Kunde</h3>
                </div>
                <span className="text-xs text-gray-500">Sortiert nach Arbeitszeit</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientStats.map((stat, index) => {
                  const timePercentage =
                    currentStats.totalTime > 0
                      ? (stat.time / currentStats.totalTime) * 100
                      : 0;
                  const completionRate = stat.tasks > 0 ? (stat.completed / stat.tasks) * 100 : 0;

                  return (
                    <Tooltip
                      key={stat.client?.id || index}
                      content={
                        <div className="text-center">
                          <div className="font-medium">{stat.client?.name}</div>
                          <div>{stat.completed}/{stat.tasks} Aufgaben erledigt</div>
                          <div>{formatDuration(stat.time)} erfasst</div>
                        </div>
                      }
                    >
                      <div className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all cursor-default">
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: stat.client?.color }}
                          >
                            {stat.client?.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">{stat.client?.name}</div>
                            <div className="text-xs text-gray-500">{formatDuration(stat.time)}</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Abgeschlossen</span>
                            <span className="font-medium text-gray-900">{stat.completed}/{stat.tasks}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${completionRate}%`,
                                backgroundColor: stat.client?.color,
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>{timePercentage.toFixed(0)}% der Gesamtzeit</span>
                          </div>
                        </div>
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {currentStats.total === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 mb-2">Noch keine Daten für diesen Zeitraum</p>
              <p className="text-sm text-gray-400">Erstelle Aufgaben und erfasse Zeit, um Statistiken zu sehen</p>
            </div>
          )}

          {/* Detailed Analytics (Expert Mode) */}
          {showDetailedAnalytics && (
            <div className="mt-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-5 border border-purple-100 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-purple-600" />
                  <h3 className="font-medium text-gray-900">Erweiterte Analytics</h3>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-auto">Expert Mode</span>
                </div>
                <DetailedAnalytics />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
