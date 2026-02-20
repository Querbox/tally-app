import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ExternalLink, Trash2, Loader2, Globe } from 'lucide-react';
import { openUrl } from '../../utils/openUrl';

// ── Types ────────────────────────────────────────────────────────────────

interface OgMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
  favicon: string | null;
  url: string;
}

// ── Cache ────────────────────────────────────────────────────────────────

const ogCache = new Map<string, OgMetadata>();

async function fetchOgMetadata(url: string): Promise<OgMetadata> {
  if (ogCache.has(url)) return ogCache.get(url)!;

  try {
    const data = await invoke<OgMetadata>('fetch_og_metadata', { url });
    ogCache.set(url, data);
    return data;
  } catch {
    // Return minimal fallback
    const fallback: OgMetadata = {
      title: null,
      description: null,
      image: null,
      site_name: null,
      favicon: null,
      url,
    };
    ogCache.set(url, fallback);
    return fallback;
  }
}

// ── Hostname helper ──────────────────────────────────────────────────────

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// ── React Component ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LinkPreviewComponent({ node, deleteNode, editor }: any) {
  const { url } = node.attrs;
  const [meta, setMeta] = useState<OgMetadata>({
    title: node.attrs.title || null,
    description: node.attrs.description || null,
    image: node.attrs.image || null,
    site_name: node.attrs.siteName || null,
    favicon: node.attrs.favicon || null,
    url,
  });
  const [loading, setLoading] = useState(!node.attrs.title);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    // If we already have stored metadata, don't fetch again
    if (node.attrs.title) {
      setLoading(false);
      return;
    }

    fetchOgMetadata(url).then((data) => {
      setMeta(data);
      setLoading(false);
    });
  }, [url, node.attrs.title]);

  const hostname = getHostname(url);
  const title = meta.title || hostname;
  const description = meta.description;
  const image = !imgError ? meta.image : null;
  const favicon = meta.favicon;

  return (
    <NodeViewWrapper className="my-3" data-no-drag>
      <div
        className="group relative border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-md transition-all duration-200 cursor-pointer bg-white"
        onClick={() => openUrl(url)}
      >
        {/* Delete button (only in edit mode) */}
        {editor.isEditable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteNode();
            }}
            className="absolute top-2 right-2 z-10 p-1.5 bg-white/90 backdrop-blur-sm text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {loading ? (
          /* Loading state */
          <div className="flex items-center gap-3 p-4">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-500 truncate">{url}</div>
              <div className="text-xs text-gray-400 mt-1">Lade Vorschau...</div>
            </div>
          </div>
        ) : (
          /* Loaded state */
          <div className="flex">
            {/* Text content */}
            <div className="flex-1 min-w-0 p-4">
              {/* Site name / hostname with favicon */}
              <div className="flex items-center gap-1.5 mb-1">
                {favicon ? (
                  <img
                    src={favicon}
                    alt=""
                    className="w-4 h-4 rounded-sm flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                )}
                <span className="text-xs text-gray-500 truncate">
                  {meta.site_name || hostname}
                </span>
                <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
              </div>

              {/* Title */}
              <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
                {title}
              </h4>

              {/* Description */}
              {description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            {/* Preview image (right side) */}
            {image && (
              <div className="flex-shrink-0 w-[120px] h-[90px] relative">
                <img
                  src={image}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ── TipTap Node Extension ────────────────────────────────────────────────

export const LinkPreview = Node.create({
  name: 'linkPreview',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: { default: '' },
      title: { default: null },
      description: { default: null },
      image: { default: null },
      siteName: { default: null },
      favicon: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-link-preview]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-link-preview': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewComponent);
  },

  addCommands() {
    return {
      insertLinkPreview:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});

// Type augmentation
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    linkPreview: {
      insertLinkPreview: (attrs: { url: string; title?: string; description?: string; image?: string; siteName?: string; favicon?: string }) => ReturnType;
    };
  }
}
