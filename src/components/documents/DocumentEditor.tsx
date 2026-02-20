import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { common, createLowlight } from 'lowlight';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  CheckSquare,
  Undo,
  Redo,
  Code2,
  Underline as UnderlineIcon,
  Highlighter,
  ExternalLink,
  Trash2,
  Type,
  Minus,
} from 'lucide-react';
import { TallyMarks, TallyIcon } from './TallyMarksExtension';
import { LinkPreview } from './LinkPreviewExtension';
import { openUrl } from '../../utils/openUrl';

// Erweitere Editor-Typen für TallyMarks
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tallyMarks: {
      insertTallyMarks: (attrs?: { count?: number; label?: string }) => ReturnType;
    };
  }
}

const lowlight = createLowlight(common);

interface DocumentEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
}

// URL validation helper
function isValidUrl(str: string): boolean {
  if (/^https?:\/\//i.test(str)) return true;
  // Also match things like "example.com/path" with a dot
  if (/^[^\s]+\.[^\s]+/.test(str)) return true;
  return false;
}

function normalizeUrl(url: string): string {
  if (!/^https?:\/\//i.test(url) && !url.startsWith('mailto:')) {
    return 'https://' + url;
  }
  return url;
}

// Link Edit Popup Component
function LinkEditPopup({
  editor,
  onClose,
}: {
  editor: ReturnType<typeof useEditor>;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(editor?.getAttributes('link').href || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSaveAsLink = () => {
    if (!editor) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const finalUrl = normalizeUrl(url);
      editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
    }
    onClose();
  };

  const handleSaveAsPreview = () => {
    if (!editor || !url) return;
    const finalUrl = normalizeUrl(url);
    // Remove any existing link mark, then insert a link preview block
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    editor.chain().focus().insertLinkPreview({ url: finalUrl }).run();
    onClose();
  };

  const handleRemove = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  const handleOpenLink = () => {
    if (url) openUrl(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3 min-w-[340px]">
      <div className="flex items-center gap-2 mb-2">
        <LinkIcon className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-700">Link bearbeiten</span>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveAsLink();
          }
          if (e.key === 'Escape') {
            onClose();
          }
        }}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {url && (
            <button
              onClick={handleOpenLink}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Link öffnen"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleRemove}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Link entfernen"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          {url && (
            <button
              onClick={handleSaveAsPreview}
              className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              title="Als Vorschau-Karte einfügen"
            >
              Vorschau
            </button>
          )}
          <button
            onClick={handleSaveAsLink}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Link
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Paste Link Prompt ────────────────────────────────────────────────────

function PasteLinkPrompt({
  url,
  onAsLink,
  onAsPreview,
  onDismiss,
}: {
  url: string;
  onAsLink: () => void;
  onAsPreview: () => void;
  onDismiss: () => void;
}) {
  const hostname = (() => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  })();

  // Auto-dismiss after 5 seconds → insert as normal link
  useEffect(() => {
    const timer = setTimeout(onAsLink, 5000);
    return () => clearTimeout(timer);
  }, [onAsLink]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10001] animate-slide-up">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3 flex items-center gap-3">
        <span className="text-sm text-gray-600 whitespace-nowrap">
          <span className="font-medium text-gray-900">{hostname}</span> einfügen als:
        </span>
        <button
          onClick={onAsLink}
          className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
        >
          Link
        </button>
        <button
          onClick={onAsPreview}
          className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
        >
          Vorschau
        </button>
        <button
          onClick={onDismiss}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <span className="sr-only">Schließen</span>
          ×
        </button>
      </div>
    </div>
  );
}

// Slash Command Menu Items
interface SlashCommand {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  keywords?: string[];
}

const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'h1', label: 'Überschrift 1', icon: Heading1, description: 'Große Überschrift', keywords: ['heading', 'title'] },
  { id: 'h2', label: 'Überschrift 2', icon: Heading2, description: 'Mittlere Überschrift', keywords: ['heading', 'subtitle'] },
  { id: 'h3', label: 'Überschrift 3', icon: Heading3, description: 'Kleine Überschrift', keywords: ['heading'] },
  { id: 'paragraph', label: 'Text', icon: Type, description: 'Normaler Absatz', keywords: ['text', 'absatz'] },
  { id: 'bullet', label: 'Aufzählung', icon: List, description: 'Einfache Liste', keywords: ['liste', 'list', 'bullet'] },
  { id: 'numbered', label: 'Nummerierung', icon: ListOrdered, description: 'Nummerierte Liste', keywords: ['liste', 'number', 'ordered'] },
  { id: 'todo', label: 'Checkliste', icon: CheckSquare, description: 'To-Do Liste', keywords: ['task', 'checkbox', 'aufgabe'] },
  { id: 'tally', label: 'Strichliste', icon: TallyIcon, description: 'Zähler mit Strichen', keywords: ['counter', 'zaehler', 'count', 'tally'] },
  { id: 'quote', label: 'Zitat', icon: Quote, description: 'Blockquote', keywords: ['blockquote', 'zitieren'] },
  { id: 'code', label: 'Code Block', icon: Code2, description: 'Syntax-Highlighting', keywords: ['programming', 'syntax'] },
  { id: 'divider', label: 'Trennlinie', icon: Minus, description: 'Horizontale Linie', keywords: ['separator', 'line', 'hr'] },
  { id: 'table', label: 'Tabelle', icon: TableIcon, description: '3x3 Tabelle', keywords: ['grid', 'cells'] },
  { id: 'image', label: 'Bild', icon: ImageIcon, description: 'Bild einfügen', keywords: ['photo', 'picture', 'foto'] },
];


export function DocumentEditor({
  content,
  onChange,
  placeholder = 'Beginne zu schreiben... Tippe / für Befehle',
  editable = true,
}: DocumentEditorProps) {
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuFilter, setSlashMenuFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [pastedUrl, setPastedUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer hover:text-blue-800',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full rounded-lg my-4',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full',
        },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2 bg-gray-50 font-semibold',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'not-prose pl-0',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2 my-1',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'bg-gray-900 text-gray-100 rounded-lg p-4 my-4 overflow-x-auto text-sm font-mono',
        },
      }),
      Underline,
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-200 rounded px-0.5',
        },
      }),
      Typography,
      TallyMarks,
      LinkPreview,
    ],
    content: content ? JSON.parse(content) : undefined,
    editable,
    editorProps: {
      attributes: {
        spellcheck: 'true',
        'data-gramm': 'false', // Disable Grammarly
      },
      handleClick(_view, _pos, event) {
        // Open links in system browser on click
        const target = event.target as HTMLElement;
        const link = target.closest('a');
        if (link) {
          const href = link.getAttribute('href');
          if (href) {
            event.preventDefault();
            openUrl(href);
            return true;
          }
        }
        return false;
      },
      handlePaste(_view, event) {
        const text = event.clipboardData?.getData('text/plain')?.trim();
        if (text && isValidUrl(text)) {
          // Pasted a bare URL — show the prompt to choose link type
          setPastedUrl(normalizeUrl(text));
          // Let TipTap handle the default paste (inserts as text with auto-link)
        }
        return false; // Don't prevent default paste
      },
    },
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      onChange(json);

      // Check for slash command
      const { selection } = editor.state;
      const { $from } = selection;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

      if (textBefore.endsWith('/')) {
        setSlashMenuOpen(true);
        setSlashMenuFilter('');
        setSelectedSlashIndex(0);
      } else if (slashMenuOpen) {
        const slashIndex = textBefore.lastIndexOf('/');
        if (slashIndex >= 0) {
          const filter = textBefore.slice(slashIndex + 1).toLowerCase();
          setSlashMenuFilter(filter);
          setSelectedSlashIndex(0);
        } else {
          setSlashMenuOpen(false);
        }
      }
    },
  });

  // Update content when it changes from outside
  useEffect(() => {
    if (editor && content) {
      const currentContent = JSON.stringify(editor.getJSON());
      if (currentContent !== content) {
        editor.commands.setContent(JSON.parse(content));
      }
    }
  }, [content, editor]);

  // Filter slash commands (including keywords)
  const filteredCommands = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(slashMenuFilter) ||
      cmd.description.toLowerCase().includes(slashMenuFilter) ||
      cmd.keywords?.some(kw => kw.toLowerCase().includes(slashMenuFilter))
  );

  // Execute slash command
  const executeSlashCommand = useCallback(
    (commandId: string) => {
      if (!editor) return;

      // Delete the slash and filter text
      const { selection } = editor.state;
      const { $from } = selection;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
      const slashIndex = textBefore.lastIndexOf('/');

      if (slashIndex >= 0) {
        const deleteFrom = $from.pos - (textBefore.length - slashIndex);
        editor.chain().focus().deleteRange({ from: deleteFrom, to: $from.pos }).run();
      }

      // Execute command
      switch (commandId) {
        case 'h1':
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case 'h2':
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case 'h3':
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          break;
        case 'paragraph':
          editor.chain().focus().setParagraph().run();
          break;
        case 'bullet':
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'numbered':
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'todo':
          editor.chain().focus().toggleTaskList().run();
          break;
        case 'tally':
          editor.chain().focus().insertTallyMarks({ count: 0 }).run();
          break;
        case 'quote':
          editor.chain().focus().toggleBlockquote().run();
          break;
        case 'code':
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case 'divider':
          editor.chain().focus().setHorizontalRule().run();
          break;
        case 'table':
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          break;
        case 'image':
          // Öffne Datei-Dialog statt URL-Prompt
          imageInputRef.current?.click();
          break;
      }

      setSlashMenuOpen(false);
    },
    [editor]
  );

  // Handle image file selection
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    // Prüfe Dateityp
    if (!file.type.startsWith('image/')) {
      alert('Bitte wähle eine Bilddatei aus.');
      return;
    }

    // Konvertiere zu Base64 für lokale Speicherung
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      editor.chain().focus().setImage({ src: base64 }).run();
    };
    reader.readAsDataURL(file);

    // Reset input für erneute Auswahl der gleichen Datei
    e.target.value = '';
  }, [editor]);

  // Handle keyboard in slash menu - mit capture phase um vor TipTap zu reagieren
  useEffect(() => {
    if (!slashMenuOpen || !editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedSlashIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter' && filteredCommands.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        executeSlashCommand(filteredCommands[selectedSlashIndex].id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSlashMenuOpen(false);
      }
    };

    // Capture phase damit wir vor TipTap reagieren können
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [slashMenuOpen, filteredCommands, selectedSlashIndex, executeSlashCommand, editor]);

  const setLink = useCallback(() => {
    setShowLinkPopup(true);
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <div className="document-editor">
      {/* Minimal Toolbar - nur Undo/Redo, Rest über Floating Toolbar und / Commands */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-white/50">
        <div className="flex items-center gap-1">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-500"
            title="Rückgängig (⌘Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-500"
            title="Wiederholen (⌘⇧Z)"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-gray-400">
          Tippe <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">/</kbd> für Befehle
        </div>
      </div>

      {/* Bubble Menu (appears on text selection) */}
      <BubbleMenu
        editor={editor}
        className="bg-gray-900 rounded-lg shadow-xl flex items-center gap-0.5 p-1"
      >
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('bold') ? 'bg-gray-700 text-white' : 'text-gray-300'
          }`}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('italic') ? 'bg-gray-700 text-white' : 'text-gray-300'
          }`}
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('underline') ? 'bg-gray-700 text-white' : 'text-gray-300'
          }`}
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('strike') ? 'bg-gray-700 text-white' : 'text-gray-300'
          }`}
        >
          <Strikethrough className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('highlight') ? 'bg-yellow-500 text-gray-900' : 'text-gray-300'
          }`}
        >
          <Highlighter className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-gray-700 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('code') ? 'bg-gray-700 text-white' : 'text-gray-300'
          }`}
        >
          <Code className="w-4 h-4" />
        </button>
        <button
          onClick={setLink}
          className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
            editor.isActive('link') ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
        </button>
      </BubbleMenu>

      {/* Floating Menu (appears on empty line) */}
      <FloatingMenu
        editor={editor}
        className="bg-white rounded-lg shadow-lg border border-gray-200 p-1"
      >
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
            title="Überschrift 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
            title="Überschrift 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
            title="Aufzählung"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
            title="Checkliste"
          >
            <CheckSquare className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
            title="Zitat"
          >
            <Quote className="w-4 h-4" />
          </button>
        </div>
      </FloatingMenu>

      {/* Slash Command Menu */}
      {slashMenuOpen && filteredCommands.length > 0 && (
        <div className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[240px] max-h-[300px] overflow-y-auto"
             style={{
               position: 'fixed',
               top: '50%',
               left: '50%',
               transform: 'translate(-50%, -50%)'
             }}>
          <div className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Blöcke einfügen
          </div>
          {filteredCommands.map((cmd, index) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                onClick={() => executeSlashCommand(cmd.id)}
                className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                  index === selectedSlashIndex ? 'bg-blue-50' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  index === selectedSlashIndex ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900">{cmd.label}</div>
                  <div className="text-xs text-gray-500">{cmd.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Link Edit Popup */}
      {showLinkPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowLinkPopup(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <LinkEditPopup editor={editor} onClose={() => setShowLinkPopup(false)} />
          </div>
        </div>
      )}

      {/* Hidden file input for image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="prose prose-gray max-w-none p-4 min-h-[300px] focus:outline-none"
      />

      {/* Paste URL Prompt — shown when a bare URL is pasted */}
      {pastedUrl && (
        <PasteLinkPrompt
          url={pastedUrl}
          onAsLink={() => {
            // Already pasted as text/auto-linked — just dismiss
            setPastedUrl(null);
          }}
          onAsPreview={() => {
            if (editor) {
              // Undo the pasted text, then insert a link preview block
              editor.chain().focus().undo().insertLinkPreview({ url: pastedUrl }).run();
            }
            setPastedUrl(null);
          }}
          onDismiss={() => setPastedUrl(null)}
        />
      )}
    </div>
  );
}
