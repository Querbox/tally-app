import { type LucideIcon, Plus, Calendar, Users, Tag, Clock, ListChecks } from 'lucide-react';

export type EmptyStateType =
  | 'tasks'
  | 'meetings'
  | 'clients'
  | 'tags'
  | 'stats'
  | 'search'
  | 'filtered';

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateType, {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
  iconColor: string;
}> = {
  tasks: {
    icon: ListChecks,
    title: 'Keine Aufgaben für heute',
    description: 'Starte den Tag mit einer neuen Aufgabe oder plane deine Meetings.',
    gradient: 'from-blue-50 to-indigo-50',
    iconColor: 'text-blue-500',
  },
  meetings: {
    icon: Calendar,
    title: 'Keine Meetings heute',
    description: 'Genieße einen meetingfreien Tag oder plane ein neues Meeting.',
    gradient: 'from-purple-50 to-pink-50',
    iconColor: 'text-purple-500',
  },
  clients: {
    icon: Users,
    title: 'Noch keine Kunden',
    description: 'Fuege deinen ersten Kunden hinzu, um Aufgaben zuzuordnen.',
    gradient: 'from-emerald-50 to-teal-50',
    iconColor: 'text-emerald-500',
  },
  tags: {
    icon: Tag,
    title: 'Noch keine Tags',
    description: 'Erstelle Tags, um deine Aufgaben besser zu organisieren.',
    gradient: 'from-amber-50 to-orange-50',
    iconColor: 'text-amber-500',
  },
  stats: {
    icon: Clock,
    title: 'Noch keine Daten',
    description: 'Beginne mit dem Tracken deiner Arbeitszeit, um Statistiken zu sehen.',
    gradient: 'from-cyan-50 to-blue-50',
    iconColor: 'text-cyan-500',
  },
  search: {
    icon: ListChecks,
    title: 'Keine Ergebnisse',
    description: 'Versuche einen anderen Suchbegriff oder aendere die Filter.',
    gradient: 'from-gray-50 to-slate-50',
    iconColor: 'text-gray-400',
  },
  filtered: {
    icon: ListChecks,
    title: 'Keine passenden Aufgaben',
    description: 'Aendere die Filtereinstellungen, um mehr Aufgaben zu sehen.',
    gradient: 'from-gray-50 to-slate-50',
    iconColor: 'text-gray-400',
  },
};

export function EmptyState({
  type,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const config = EMPTY_STATE_CONFIG[type];
  const Icon = config.icon;
  const ActionIcon = action?.icon || Plus;

  return (
    <div className={`text-center py-12 px-6 rounded-2xl bg-gradient-to-br ${config.gradient} animate-fade-in ${className}`}>
      {/* Icon with decorative background */}
      <div className="relative inline-flex">
        <div className="absolute inset-0 bg-white/60 rounded-full blur-xl scale-150" />
        <div className="relative w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center">
          <Icon className={`w-8 h-8 ${config.iconColor}`} />
        </div>
      </div>

      {/* Text Content */}
      <h3 className="mt-5 text-base font-semibold text-gray-800">
        {title || config.title}
      </h3>
      <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto">
        {description || config.description}
      </p>

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-sm btn-press"
        >
          <ActionIcon className="w-4 h-4" />
          {action.label}
        </button>
      )}
    </div>
  );
}
