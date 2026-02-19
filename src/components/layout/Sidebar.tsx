import { useState } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getTodayString } from '../../utils/dateUtils';
import {
  Calendar,
  CalendarDays,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  Sparkles,
  MoreHorizontal,
  BarChart3,
  Video,
  Archive,
} from 'lucide-react';
import { ClientDetailModal } from '../modals/ClientDetailModal';
import { UpdateModal } from '../modals/UpdateModal';
import { WhatsNewModal } from '../modals/WhatsNewModal';
import { CURRENT_VERSION } from '../../data/releases';
import { TimeTrackerWidget } from '../time/TimeTrackerWidget';
import { WorkTimeView } from '../../views/WorkTimeView';
import { StatsView } from '../../views/StatsView';
import { MeetingsView } from '../../views/MeetingsView';
import { ArchiveView } from '../../views/ArchiveView';
import { ClientDot } from '../clients/ClientAvatar';
import type { Client } from '../../types';

interface SidebarProps {
  currentView: 'day' | 'calendar';
  onViewChange: (view: 'day' | 'calendar') => void;
  onOpenSettings: () => void;
}

export function Sidebar({ currentView, onViewChange, onOpenSettings }: SidebarProps) {
  const clients = useTaskStore((s) => s.clients);
  const tasks = useTaskStore((s) => s.tasks);
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const workTimeWidgetCollapsed = useSettingsStore((s) => s.workTimeWidgetCollapsed);
  const toggleWorkTimeWidget = useSettingsStore((s) => s.toggleWorkTimeWidget);
  const appVersion = useSettingsStore((s) => s.appVersion);

  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showWorkTimeView, setShowWorkTimeView] = useState(false);
  const [showStatsView, setShowStatsView] = useState(false);
  const [showMeetingsView, setShowMeetingsView] = useState(false);
  const [showArchiveView, setShowArchiveView] = useState(false);

  const today = getTodayString();
  const todayTasks = tasks.filter((t) => t.scheduledDate === today && !t.isMeeting);
  const completedToday = todayTasks.filter((t) => t.status === 'completed').length;

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setIsNewClient(false);
    setShowClientModal(true);
  };

  const handleNewClient = () => {
    setSelectedClient(null);
    setIsNewClient(true);
    setShowClientModal(true);
  };

  const getClientTaskCount = (clientId: string) => {
    return tasks.filter((t) => t.clientId === clientId && t.status !== 'completed').length;
  };

  return (
    <>
      <aside
        className={`${
          sidebarCollapsed ? 'w-16' : 'w-60'
        } bg-white/80 glass border-r border-gray-200/50 h-full flex flex-col transition-all duration-300 ease-out`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div
            className={`flex items-center gap-2.5 overflow-hidden transition-all duration-300 ${
              sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            }`}
          >
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-semibold">T</span>
            </div>
            <span className="font-semibold text-gray-900 whitespace-nowrap">Tally</span>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 btn-press flex-shrink-0"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto overflow-x-hidden">
          <ul className="space-y-1">
            <li className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.05s', animationFillMode: 'forwards' }}>
              <button
                onClick={() => onViewChange('day')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 btn-press ${
                  currentView === 'day'
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                title={sidebarCollapsed ? 'Heute' : undefined}
              >
                <Calendar className="w-5 h-5 flex-shrink-0" />
                <span
                  className={`text-sm whitespace-nowrap transition-all duration-300 ${
                    sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
                  }`}
                >
                  Heute
                </span>
              </button>
            </li>
            <li className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
              <button
                onClick={() => onViewChange('calendar')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 btn-press ${
                  currentView === 'calendar'
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                title={sidebarCollapsed ? 'Woche' : undefined}
              >
                <CalendarDays className="w-5 h-5 flex-shrink-0" />
                <span
                  className={`text-sm whitespace-nowrap transition-all duration-300 ${
                    sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
                  }`}
                >
                  Woche
                </span>
              </button>
            </li>
            <li className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.15s', animationFillMode: 'forwards' }}>
              <button
                onClick={() => setShowMeetingsView(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 btn-press text-gray-600 hover:bg-gray-50"
                title={sidebarCollapsed ? 'Meetings' : undefined}
              >
                <Video className="w-5 h-5 flex-shrink-0" />
                <span
                  className={`text-sm whitespace-nowrap transition-all duration-300 ${
                    sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
                  }`}
                >
                  Meetings
                </span>
              </button>
            </li>
            <li className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
              <button
                onClick={() => setShowStatsView(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 btn-press text-gray-600 hover:bg-gray-50"
                title={sidebarCollapsed ? 'Statistiken' : undefined}
              >
                <BarChart3 className="w-5 h-5 flex-shrink-0" />
                <span
                  className={`text-sm whitespace-nowrap transition-all duration-300 ${
                    sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
                  }`}
                >
                  Statistiken
                </span>
              </button>
            </li>
            <li className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.25s', animationFillMode: 'forwards' }}>
              <button
                onClick={() => setShowArchiveView(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 btn-press text-gray-600 hover:bg-gray-50"
                title={sidebarCollapsed ? 'Archiv' : undefined}
              >
                <Archive className="w-5 h-5 flex-shrink-0" />
                <span
                  className={`text-sm whitespace-nowrap transition-all duration-300 ${
                    sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
                  }`}
                >
                  Archiv
                </span>
              </button>
            </li>
          </ul>

          {/* Clients Section */}
          <div
            className={`mt-6 animate-fade-in-up opacity-0 ${sidebarCollapsed ? 'px-1' : ''}`}
            style={{ animationDelay: '0.15s', animationFillMode: 'forwards' }}
          >
            <div
              className={`flex items-center justify-between mb-2 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}
            >
              {!sidebarCollapsed && (
                <h3 className="text-xs text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  Kunden
                </h3>
              )}
              <button
                onClick={handleNewClient}
                className={`p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-200 btn-press ${
                  sidebarCollapsed ? 'mx-auto' : ''
                }`}
                title="Neuer Kunde"
              >
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <ul className="space-y-0.5">
              {clients.length === 0 ? (
                !sidebarCollapsed && (
                  <li className="px-3 py-2">
                    <p className="text-xs text-gray-400">Keine Kunden</p>
                  </li>
                )
              ) : (
                clients
                  .filter((c) => c.isActive)
                  .map((client, index) => {
                    const taskCount = getClientTaskCount(client.id);
                    return (
                      <li
                        key={client.id}
                        className="animate-fade-in-up opacity-0"
                        style={{
                          animationDelay: `${0.2 + index * 0.05}s`,
                          animationFillMode: 'forwards',
                        }}
                      >
                        <button
                          onClick={() => handleEditClient(client)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-all duration-200 group ${
                            sidebarCollapsed ? 'justify-center' : ''
                          }`}
                          title={sidebarCollapsed ? client.name : undefined}
                        >
                          <ClientDot client={client} size="sm" />
                          {!sidebarCollapsed && (
                            <>
                              <span className="flex-1 text-left truncate">{client.name}</span>
                              {taskCount > 0 && (
                                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {taskCount}
                                </span>
                              )}
                              <MoreHorizontal className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </>
                          )}
                        </button>
                      </li>
                    );
                  })
              )}
            </ul>

            {/* Inactive Clients */}
            {!sidebarCollapsed && clients.filter((c) => !c.isActive).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <h4 className="text-xs text-gray-400 px-3 mb-1">Inaktiv</h4>
                <ul className="space-y-0.5">
                  {clients
                    .filter((c) => !c.isActive)
                    .map((client) => (
                      <li key={client.id}>
                        <button
                          onClick={() => handleEditClient(client)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 rounded-xl hover:bg-gray-50 transition-all duration-200"
                        >
                          <span className="opacity-50">
                            <ClientDot client={client} size="sm" />
                          </span>
                          <span className="truncate">{client.name}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-gray-100">
          {/* Time Tracker Widget */}
          <div className="mb-2 animate-fade-in">
            <TimeTrackerWidget
              collapsed={sidebarCollapsed}
              onOpenDetail={() => setShowWorkTimeView(true)}
              isWidgetCollapsed={workTimeWidgetCollapsed}
              onToggleWidget={toggleWorkTimeWidget}
            />
          </div>

          {/* Progress */}
          {todayTasks.length > 0 && !sidebarCollapsed && (
            <div className="mb-2 px-3 py-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Aufgaben</span>
                <span>
                  {completedToday}/{todayTasks.length}
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-900 rounded-full transition-all duration-500"
                  style={{
                    width: `${(completedToday / todayTasks.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Update Button */}
          <button
            onClick={() => setShowUpdateModal(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all duration-200 btn-press ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
            title={sidebarCollapsed ? 'Updates' : undefined}
          >
            <Sparkles className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="flex-1 text-left">
                Updates
                <span className="text-xs text-gray-400 ml-1">v{appVersion}</span>
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all duration-200 btn-press ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
            title={sidebarCollapsed ? 'Einstellungen' : undefined}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Einstellungen</span>}
          </button>
        </div>
      </aside>

      {/* Client Modal */}
      {showClientModal && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setShowClientModal(false)}
          isNew={isNewClient}
        />
      )}

      {/* Update Modal */}
      {showUpdateModal && (
        <UpdateModal
          onClose={() => setShowUpdateModal(false)}
          onShowWhatsNew={() => {
            setShowUpdateModal(false);
            setShowWhatsNew(true);
          }}
        />
      )}

      {/* What's New Modal */}
      {showWhatsNew && (
        <WhatsNewModal
          onClose={() => setShowWhatsNew(false)}
          currentVersion={CURRENT_VERSION}
          lastSeenVersion={null}
        />
      )}

      {/* Work Time View */}
      {showWorkTimeView && <WorkTimeView onClose={() => setShowWorkTimeView(false)} />}

      {/* Stats View */}
      {showStatsView && <StatsView onClose={() => setShowStatsView(false)} />}

      {/* Meetings View */}
      {showMeetingsView && <MeetingsView onClose={() => setShowMeetingsView(false)} />}

      {/* Archive View */}
      {showArchiveView && <ArchiveView onClose={() => setShowArchiveView(false)} />}
    </>
  );
}
