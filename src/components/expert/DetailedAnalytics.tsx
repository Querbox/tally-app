import { useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  Calendar,
  Target,
  Zap,
  AlertTriangle,
  BarChart3,
  Minus
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, subtitle, trend, icon, color }: StatCardProps) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-start justify-between mb-2">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
            trend > 0 ? 'text-green-100 bg-green-500/20' :
            trend < 0 ? 'text-red-100 bg-red-500/20' : 'text-white/60 bg-white/10'
          }`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> :
             trend < 0 ? <TrendingDown className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/70 mt-0.5">{title}</div>
      {subtitle && <div className="text-xs text-white/50 mt-0.5">{subtitle}</div>}
    </div>
  );
}

interface TimeDistributionProps {
  data: { label: string; value: number; color: string }[];
  total: number;
}

function TimeDistribution({ data, total }: TimeDistributionProps) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2 text-sm">
        <Clock className="w-4 h-4 text-blue-500" />
        Zeitverteilung nach Kunde
      </h3>
      <div className="space-y-2.5">
        {data.slice(0, 5).map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={index}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-700 font-medium truncate max-w-[60%]">{item.label}</span>
                <span className="text-gray-500 tabular-nums">
                  {Math.floor(item.value / 60)}h {Math.round(item.value % 60)}m
                  <span className="text-gray-400 ml-1">({percentage.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
        <span className="text-gray-500">Gesamt</span>
        <span className="font-medium text-gray-900 tabular-nums">
          {Math.floor(total / 60)}h {Math.round(total % 60)}m
        </span>
      </div>
    </div>
  );
}

interface ProductivityInsight {
  type: 'success' | 'warning' | 'info';
  title: string;
  description: string;
}

function InsightsCard({ insights }: { insights: ProductivityInsight[] }) {
  const icons = {
    success: <CheckCircle className="w-4 h-4 text-green-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    info: <Zap className="w-4 h-4 text-blue-500" />,
  };

  const colors = {
    success: 'bg-green-50 border-green-100',
    warning: 'bg-amber-50 border-amber-100',
    info: 'bg-blue-50 border-blue-100',
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2 text-sm">
        <Target className="w-4 h-4 text-purple-500" />
        Produktivitäts-Insights
      </h3>
      <div className="space-y-2">
        {insights.map((insight, index) => (
          <div
            key={index}
            className={`p-2.5 rounded-lg border ${colors[insight.type]}`}
          >
            <div className="flex items-start gap-2">
              {icons[insight.type]}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800">{insight.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface WeeklyComparisonProps {
  thisWeek: { completed: number; time: number };
  lastWeek: { completed: number; time: number };
}

function WeeklyComparison({ thisWeek, lastWeek }: WeeklyComparisonProps) {
  const completedChange = lastWeek.completed > 0
    ? Math.round(((thisWeek.completed - lastWeek.completed) / lastWeek.completed) * 100)
    : 0;
  const timeChange = lastWeek.time > 0
    ? Math.round(((thisWeek.time - lastWeek.time) / lastWeek.time) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2 text-sm">
        <BarChart3 className="w-4 h-4 text-indigo-500" />
        Wochenvergleich
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-xl font-bold text-gray-900 tabular-nums">{thisWeek.completed}</p>
          <p className="text-xs text-gray-500 mt-0.5">Aufgaben diese Woche</p>
          {completedChange !== 0 && (
            <p className={`text-xs mt-1.5 flex items-center justify-center gap-0.5 ${
              completedChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {completedChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {completedChange >= 0 ? '+' : ''}{completedChange}%
            </p>
          )}
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-xl font-bold text-gray-900 tabular-nums">
            {Math.floor(thisWeek.time / 60)}h
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Zeit diese Woche</p>
          {timeChange !== 0 && (
            <p className={`text-xs mt-1.5 flex items-center justify-center gap-0.5 ${
              timeChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {timeChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {timeChange >= 0 ? '+' : ''}{timeChange}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function DetailedAnalytics() {
  const tasks = useTaskStore((s) => s.tasks);
  const clients = useTaskStore((s) => s.clients);
  const weeklyWorkHours = useSettingsStore((s) => s.weeklyWorkHours);

  const analytics = useMemo(() => {
    const now = new Date();

    // Diese Woche
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    // Letzte Woche
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfWeek);
    endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);
    const startOfLastWeekStr = startOfLastWeek.toISOString().split('T')[0];
    const endOfLastWeekStr = endOfLastWeek.toISOString().split('T')[0];

    // Letzter Monat
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

    // Statistiken berechnen
    const thisWeekTasks = tasks.filter(t =>
      t.completedAt && t.completedAt >= startOfWeekStr
    );
    const lastWeekTasks = tasks.filter(t =>
      t.completedAt && t.completedAt >= startOfLastWeekStr && t.completedAt <= endOfLastWeekStr
    );
    const thisMonthTasks = tasks.filter(t =>
      t.completedAt && t.completedAt >= startOfMonthStr
    );

    // Zeit berechnen
    const getTimeFromTasks = (taskList: typeof tasks) =>
      taskList.reduce((sum, t) =>
        sum + t.timeEntries.reduce((s, e) => s + (e.duration || 0), 0), 0
      ) / 60; // In Minuten

    const thisWeekTime = getTimeFromTasks(thisWeekTasks);
    const lastWeekTime = getTimeFromTasks(lastWeekTasks);
    const thisMonthTime = getTimeFromTasks(thisMonthTasks);

    // Zeit pro Kunde
    const timeByClient = clients.map(client => {
      const clientTasks = thisMonthTasks.filter(t => t.clientId === client.id);
      const time = getTimeFromTasks(clientTasks);
      return { label: client.name, value: time, color: client.color };
    }).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

    // Ohne Kunde
    const noClientTasks = thisMonthTasks.filter(t => !t.clientId);
    const noClientTime = getTimeFromTasks(noClientTasks);
    if (noClientTime > 0) {
      timeByClient.push({ label: 'Ohne Kunde', value: noClientTime, color: '#9CA3AF' });
    }

    // Durchschnittliche Aufgaben pro Tag
    const daysThisWeek = Math.min(now.getDay() || 7, 7);
    const avgTasksPerDay = daysThisWeek > 0 ? thisWeekTasks.length / daysThisWeek : 0;

    // Häufigste Verschiebungen
    const postponedTasks = tasks.filter(t => t.postponeCount > 0);
    const avgPostponeCount = postponedTasks.length > 0
      ? postponedTasks.reduce((sum, t) => sum + t.postponeCount, 0) / postponedTasks.length
      : 0;

    // Deadline-Einhaltung
    const tasksWithDeadline = thisMonthTasks.filter(t => t.deadline);
    const onTimeDeadlines = tasksWithDeadline.filter(t =>
      t.completedAt && t.deadline && t.completedAt <= t.deadline
    );
    const deadlineRate = tasksWithDeadline.length > 0
      ? (onTimeDeadlines.length / tasksWithDeadline.length) * 100
      : 100;

    // Soll-Arbeitszeit
    const targetWeeklyMinutes = weeklyWorkHours * 60;
    const weekProgress = targetWeeklyMinutes > 0
      ? (thisWeekTime / targetWeeklyMinutes) * 100
      : 0;

    // Trends berechnen
    const completedTrend = lastWeekTasks.length > 0
      ? Math.round(((thisWeekTasks.length - lastWeekTasks.length) / lastWeekTasks.length) * 100)
      : 0;

    // Insights generieren
    const insights: ProductivityInsight[] = [];

    if (thisWeekTasks.length > lastWeekTasks.length * 1.2) {
      insights.push({
        type: 'success',
        title: 'Produktivitätssteigerung!',
        description: `${thisWeekTasks.length - lastWeekTasks.length} mehr Aufgaben als letzte Woche.`
      });
    }

    if (avgPostponeCount > 2) {
      insights.push({
        type: 'warning',
        title: 'Viele Verschiebungen',
        description: `Ø ${avgPostponeCount.toFixed(1)}× pro Aufgabe. Sind die Schätzungen realistisch?`
      });
    }

    if (deadlineRate < 70) {
      insights.push({
        type: 'warning',
        title: 'Deadlines beachten',
        description: `Nur ${deadlineRate.toFixed(0)}% vor Deadline erledigt.`
      });
    } else if (deadlineRate >= 90 && tasksWithDeadline.length > 0) {
      insights.push({
        type: 'success',
        title: 'Zuverlässig!',
        description: `${deadlineRate.toFixed(0)}% deiner Deadlines eingehalten.`
      });
    }

    if (weekProgress < 50 && now.getDay() >= 3) {
      insights.push({
        type: 'info',
        title: 'Wochenziel',
        description: `Erst ${weekProgress.toFixed(0)}% erreicht. Noch ${Math.round((targetWeeklyMinutes - thisWeekTime) / 60)}h bis zum Ziel.`
      });
    }

    if (insights.length === 0) {
      insights.push({
        type: 'info',
        title: 'Alles im Griff!',
        description: 'Deine Produktivität ist im normalen Bereich.'
      });
    }

    return {
      thisWeek: { completed: thisWeekTasks.length, time: thisWeekTime },
      lastWeek: { completed: lastWeekTasks.length, time: lastWeekTime },
      thisMonth: { completed: thisMonthTasks.length, time: thisMonthTime },
      avgTasksPerDay,
      deadlineRate,
      weekProgress,
      completedTrend,
      timeByClient,
      totalTimeThisMonth: thisMonthTime,
      insights,
    };
  }, [tasks, clients, weeklyWorkHours]);

  return (
    <div className="space-y-4">
      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Aufgaben diesen Monat"
          value={analytics.thisMonth.completed}
          subtitle={`Ø ${analytics.avgTasksPerDay.toFixed(1)} pro Tag`}
          trend={analytics.completedTrend}
          icon={<CheckCircle className="w-4 h-4 text-white" />}
          color="from-green-500 to-emerald-600"
        />
        <StatCard
          title="Zeit diesen Monat"
          value={`${Math.floor(analytics.thisMonth.time / 60)}h`}
          subtitle={`${Math.round(analytics.thisMonth.time % 60)}m`}
          icon={<Clock className="w-4 h-4 text-white" />}
          color="from-blue-500 to-indigo-600"
        />
        <StatCard
          title="Wochenziel"
          value={`${analytics.weekProgress.toFixed(0)}%`}
          subtitle={`von ${weeklyWorkHours}h Soll`}
          icon={<Target className="w-4 h-4 text-white" />}
          color="from-purple-500 to-violet-600"
        />
        <StatCard
          title="Deadline-Rate"
          value={`${analytics.deadlineRate.toFixed(0)}%`}
          subtitle="pünktlich erledigt"
          icon={<Calendar className="w-4 h-4 text-white" />}
          color="from-amber-500 to-orange-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WeeklyComparison
          thisWeek={analytics.thisWeek}
          lastWeek={analytics.lastWeek}
        />
        <InsightsCard insights={analytics.insights} />
      </div>

      {/* Time Distribution */}
      {analytics.timeByClient.length > 0 && (
        <TimeDistribution
          data={analytics.timeByClient}
          total={analytics.totalTimeThisMonth}
        />
      )}
    </div>
  );
}
