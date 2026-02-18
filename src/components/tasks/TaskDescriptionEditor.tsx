import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Underline as UnderlineIcon,
  Link as LinkIcon,
} from 'lucide-react';
import { TallyMarks, TallyIcon } from '../documents/TallyMarksExtension';

// Erweitere Editor-Typen für TallyMarks
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tallyMarks: {
      insertTallyMarks: (attrs?: { count?: number; label?: string }) => ReturnType;
    };
  }
}

interface TaskDescriptionEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export function TaskDescriptionEditor({
  content,
  onChange,
  placeholder = 'Notizen, Details, Links...',
}: TaskDescriptionEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      TallyMarks,
    ],
    content: content ? parseContent(content) : '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[80px]',
      },
    },
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      onChange(json);
    },
  });

  // Parse content - could be JSON or plain text
  function parseContent(content: string): string {
    if (!content) return '';
    try {
      // Try to parse as JSON (TipTap format)
      const parsed = JSON.parse(content);
      if (parsed.type === 'doc') {
        return content; // It's TipTap JSON, return as-is for TipTap to parse
      }
    } catch {
      // Not JSON, treat as plain text
    }
    // Plain text - return as-is, TipTap will handle it
    return content;
  }

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== JSON.stringify(editor.getJSON())) {
      const parsedContent = parseContent(content);
      if (parsedContent) {
        try {
          const json = JSON.parse(parsedContent);
          if (json.type === 'doc') {
            editor.commands.setContent(json);
          } else {
            editor.commands.setContent(parsedContent);
          }
        } catch {
          editor.commands.setContent(parsedContent);
        }
      } else {
        editor.commands.setContent('');
      }
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL eingeben:', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    let finalUrl = url;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('mailto:')) {
      finalUrl = 'https://' + url;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="task-description-editor border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent">
      {/* Bubble Menu for text formatting */}
      <BubbleMenu
        editor={editor}
        className="bg-white rounded-lg shadow-xl border border-gray-200 flex items-center p-1 gap-0.5"
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
            editor.isActive('bold') ? 'bg-gray-100 text-blue-600' : 'text-gray-600'
          }`}
          title="Fett"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
            editor.isActive('italic') ? 'bg-gray-100 text-blue-600' : 'text-gray-600'
          }`}
          title="Kursiv"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
            editor.isActive('underline') ? 'bg-gray-100 text-blue-600' : 'text-gray-600'
          }`}
          title="Unterstrichen"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
            editor.isActive('strike') ? 'bg-gray-100 text-blue-600' : 'text-gray-600'
          }`}
          title="Durchgestrichen"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button
          type="button"
          onClick={setLink}
          className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
            editor.isActive('link') ? 'bg-gray-100 text-blue-600' : 'text-gray-600'
          }`}
          title="Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
      </BubbleMenu>

      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-100 bg-gray-50">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('bulletList') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
          }`}
          title="Aufzählung"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('orderedList') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
          }`}
          title="Nummerierte Liste"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('taskList') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
          }`}
          title="Checkliste"
        >
          <CheckSquare className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().insertTallyMarks().run()}
          className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600"
          title="Strichliste einfügen"
        >
          <TallyIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="p-3 min-h-[80px] max-h-[200px] overflow-y-auto"
      />

      {/* Styles for the editor */}
      <style>{`
        .task-description-editor .ProseMirror {
          min-height: 60px;
          outline: none;
        }
        .task-description-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .task-description-editor .ProseMirror p {
          margin: 0.25em 0;
          line-height: 1.5;
        }
        .task-description-editor .ProseMirror ul {
          margin: 0.25em 0;
          padding-left: 1.25em;
          list-style-type: disc;
        }
        .task-description-editor .ProseMirror ol {
          margin: 0.25em 0;
          padding-left: 1.25em;
          list-style-type: decimal;
        }
        .task-description-editor .ProseMirror li {
          margin: 0.1em 0;
          display: list-item;
        }
        .task-description-editor .ProseMirror ul li::marker {
          color: #374151;
        }
        .task-description-editor .ProseMirror ol li::marker {
          color: #374151;
          font-weight: 500;
        }
        .task-description-editor .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }
        .task-description-editor .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .task-description-editor .ProseMirror ul[data-type="taskList"] li > label {
          flex-shrink: 0;
          margin-top: 0.1rem;
        }
        .task-description-editor .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] {
          cursor: pointer;
          width: 0.875rem;
          height: 0.875rem;
        }
        .task-description-editor .ProseMirror ul[data-type="taskList"] li > div {
          flex: 1;
        }
        .task-description-editor .ProseMirror a {
          color: #2563eb;
          text-decoration: underline;
          cursor: pointer;
        }
        .task-description-editor .tally-marks-wrapper {
          display: inline-block;
          margin: 0.25em 0;
        }
      `}</style>
    </div>
  );
}

// Helper function to extract plain text from TipTap JSON (for sync preview)
export function extractPlainTextFromTipTap(contentJson: string): string {
  if (!contentJson) return '';

  try {
    const parsed = JSON.parse(contentJson);

    type TipTapNode = {
      type?: string;
      content?: TipTapNode[];
      text?: string;
      attrs?: { checked?: boolean; count?: number; label?: string };
    };

    const extractInlineText = (node: TipTapNode): string => {
      if (node.type === 'text') return node.text || '';
      if (node.content) {
        return node.content.map(extractInlineText).join('');
      }
      return '';
    };

    const processBlock = (node: TipTapNode, listPrefix = ''): string => {
      switch (node.type) {
        case 'paragraph':
        case 'heading':
          return extractInlineText(node);

        case 'bulletList':
          if (!node.content) return '';
          return node.content
            .map((item) => processBlock(item, '• '))
            .join('\n');

        case 'orderedList':
          if (!node.content) return '';
          return node.content
            .map((item, index) => processBlock(item, `${index + 1}. `))
            .join('\n');

        case 'listItem':
          if (!node.content) return '';
          const itemText = node.content.map((child) => extractInlineText(child)).join('');
          return listPrefix + itemText;

        case 'taskList':
          if (!node.content) return '';
          return node.content
            .map((item) => {
              const checked = item.attrs?.checked ? '☑' : '☐';
              const text = item.content?.map((child) => extractInlineText(child)).join('') || '';
              return `${checked} ${text}`;
            })
            .join('\n');

        case 'taskItem':
          if (!node.content) return '';
          const taskChecked = node.attrs?.checked ? '☑' : '☐';
          const taskText = node.content.map((child) => extractInlineText(child)).join('');
          return `${taskChecked} ${taskText}`;

        case 'tallyMarks':
          const tallyLabel = node.attrs?.label || 'Strichliste';
          const tallyCount = node.attrs?.count || 0;
          return `${tallyLabel}: ${tallyCount}`;

        default:
          if (node.content) {
            return node.content.map((child) => processBlock(child)).join('\n');
          }
          return '';
      }
    };

    if (!parsed.content) return '';
    return parsed.content
      .map((block: TipTapNode) => processBlock(block))
      .filter((text: string) => text.trim() !== '')
      .join('\n');
  } catch {
    // Not JSON, return as plain text
    return contentJson;
  }
}
