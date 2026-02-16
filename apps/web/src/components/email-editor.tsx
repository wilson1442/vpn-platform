'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { FontSize, FONT_SIZES } from './email-editor-font-size';
import { FieldTag } from './email-editor-field-tag';
import { useEffect, useRef, useState } from 'react';

interface Variable {
  key: string;
  description: string;
}

interface EmailEditorProps {
  content: string;
  onChange: (html: string) => void;
  variables?: Variable[];
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-cyan-500/20 text-cyan-400'
          : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <div className="mx-1 h-5 w-px bg-border/40" />;
}

export function EmailEditor({ content, onChange, variables = [] }: EmailEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontSize,
      FieldTag,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true }),
      Placeholder.configure({ placeholder: 'Start writing your email template...' }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose-editor min-h-[300px] px-4 py-3 outline-none text-sm leading-relaxed',
      },
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setShowColorPicker(false);
      if (linkRef.current && !linkRef.current.contains(e.target as Node)) setShowLinkInput(false);
      if (imageRef.current && !imageRef.current.contains(e.target as Node)) setShowImageInput(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!editor) return null;

  const COLORS = ['#ffffff', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ef4444', '#a855f7', '#3b82f6', '#64748b'];

  return (
    <div className="overflow-hidden rounded-lg border border-border/40 bg-card/30 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/40 px-2 py-1.5 bg-card/50">
        {/* Text formatting */}
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <span className="line-through">S</span>
        </ToolbarButton>

        <ToolbarSep />

        {/* Headings */}
        <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
          H1
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
          H2
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
          H3
        </ToolbarButton>

        <ToolbarSep />

        {/* Lists */}
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered List">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h10M7 16h10M3 8V6l1-1M3 12v-1h2v2H3M3 18v-2h2l-2 2" />
          </svg>
        </ToolbarButton>

        <ToolbarSep />

        {/* Alignment */}
        <ToolbarButton active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align Left">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h12M3 18h18" />
          </svg>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align Center">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 12h12M3 18h18" />
          </svg>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align Right">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 12h12M3 18h18" />
          </svg>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justify">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </ToolbarButton>

        <ToolbarSep />

        {/* Color */}
        <div className="relative" ref={colorRef}>
          <ToolbarButton active={showColorPicker} onClick={() => setShowColorPicker(!showColorPicker)} title="Text Color">
            <div className="flex flex-col items-center">
              <span className="text-[10px] leading-none">A</span>
              <div className="mt-0.5 h-0.5 w-3 rounded" style={{ background: editor.getAttributes('textStyle').color || '#ffffff' }} />
            </div>
          </ToolbarButton>
          {showColorPicker && (
            <div className="absolute left-0 top-full z-10 mt-1 grid grid-cols-5 gap-1 rounded-lg border border-border/40 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="h-5 w-5 rounded border border-border/40 transition-transform hover:scale-110"
                  style={{ background: color }}
                  onClick={() => {
                    editor.chain().focus().setColor(color).run();
                    setShowColorPicker(false);
                  }}
                />
              ))}
              <button
                type="button"
                className="col-span-5 mt-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setShowColorPicker(false);
                }}
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Font size */}
        <select
          className="h-7 rounded bg-transparent px-1 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
          value={editor.getAttributes('textStyle').fontSize || '14px'}
          onChange={(e) => {
            if (e.target.value === '14px') {
              editor.chain().focus().unsetFontSize().run();
            } else {
              editor.chain().focus().setFontSize(e.target.value).run();
            }
          }}
        >
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <ToolbarSep />

        {/* Link */}
        <div className="relative" ref={linkRef}>
          <ToolbarButton active={editor.isActive('link')} onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
            } else {
              setShowLinkInput(!showLinkInput);
            }
          }} title="Link">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </ToolbarButton>
          {showLinkInput && (
            <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-lg border border-border/40 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
              <input
                type="url"
                placeholder="https://..."
                className="w-48 rounded bg-card/60 border border-border/30 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (linkUrl) {
                      editor.chain().focus().setLink({ href: linkUrl }).run();
                      setLinkUrl('');
                      setShowLinkInput(false);
                    }
                  }
                }}
              />
              <button
                type="button"
                className="rounded bg-cyan-600 px-2 py-1 text-[10px] text-white hover:bg-cyan-500"
                onClick={() => {
                  if (linkUrl) {
                    editor.chain().focus().setLink({ href: linkUrl }).run();
                    setLinkUrl('');
                    setShowLinkInput(false);
                  }
                }}
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Image */}
        <div className="relative" ref={imageRef}>
          <ToolbarButton active={false} onClick={() => setShowImageInput(!showImageInput)} title="Image">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </ToolbarButton>
          {showImageInput && (
            <div className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-lg border border-border/40 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
              <input
                type="url"
                placeholder="Image URL..."
                className="w-48 rounded bg-card/60 border border-border/30 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (imageUrl) {
                      editor.chain().focus().setImage({ src: imageUrl }).run();
                      setImageUrl('');
                      setShowImageInput(false);
                    }
                  }
                }}
              />
              <button
                type="button"
                className="rounded bg-cyan-600 px-2 py-1 text-[10px] text-white hover:bg-cyan-500"
                onClick={() => {
                  if (imageUrl) {
                    editor.chain().focus().setImage({ src: imageUrl }).run();
                    setImageUrl('');
                    setShowImageInput(false);
                  }
                }}
              >
                Add
              </button>
            </div>
          )}
        </div>

        <ToolbarSep />

        {/* Variables dropdown */}
        {variables.length > 0 && (
          <select
            className="h-7 rounded bg-transparent px-1 text-[11px] text-cyan-400 hover:text-cyan-300 focus:outline-none cursor-pointer"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                editor.chain().focus().insertFieldTag(e.target.value).run();
              }
            }}
          >
            <option value="" disabled>Insert Variable</option>
            {variables.map((v) => (
              <option key={v.key} value={v.key}>
                {`{{${v.key}}}`} - {v.description}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
