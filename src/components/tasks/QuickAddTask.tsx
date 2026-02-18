import { useState } from 'react';
import { useTaskStore } from '../../stores/taskStore';
import { Plus } from 'lucide-react';

interface QuickAddTaskProps {
  date: string;
}

export function QuickAddTask({ date }: QuickAddTaskProps) {
  const addTask = useTaskStore((s) => s.addTask);
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addTask({
      title: title.trim(),
      status: 'todo',
      scheduledDate: date,
      tagIds: [],
      subtasks: [],
      isSpontaneous: true,
      isMeeting: false,
      timeEntries: [],
    });

    setTitle('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Neue Aufgabe hinzufugen..."
        className="flex-1 px-4 py-3 bg-white border border-gray-100 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-transparent transition-all duration-200"
      />
      <button
        type="submit"
        disabled={!title.trim()}
        className="px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 btn-press shadow-lg shadow-gray-900/20"
      >
        <Plus className="w-5 h-5" />
      </button>
    </form>
  );
}
