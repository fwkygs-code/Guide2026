import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, Type, Palette, Highlighter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FontSize } from '@/lib/fontSize';

function getEditorPlainText(editor) {
  // Preserve spaces (including trailing) better than HTML/textContent which can drop/collapse them.
  return editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\0');
}

const FONT_SIZE_OPTIONS = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '40', '48'];

const InlineRichEditor = ({ 
  content, 
  onChange, 
  placeholder = 'Type here...', 
  isRTL = false,
  className = '',
  textSize = 'text-base',
  isBold = false,
  align = 'left'
}) => {
  const [showToolbar, setShowToolbar] = React.useState(false);
  const [fontMenuOpen, setFontMenuOpen] = React.useState(false);
  const lastSyncedContentRef = React.useRef(content || '');
  const blurTimeoutRef = React.useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable block-level elements - we only want inline formatting
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontSize.configure({
        types: ['textStyle', 'heading'], // Allow fontSize in textStyle marks and heading nodes
      }),
      TextAlign.configure({
        types: ['paragraph'],
      }),
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
      }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      // Save HTML to preserve formatting (bold, italic, underline, alignment, font size)
      const html = editor.getHTML();
      lastSyncedContentRef.current = html;
      onChange(html);
    },
    onFocus: () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      setShowToolbar(true);
    },
    onBlur: () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      blurTimeoutRef.current = setTimeout(() => {
        if (!fontMenuOpen) {
          setShowToolbar(false);
        }
      }, 200);
    },
    editorProps: {
      attributes: {
        class: `focus:outline-none ${textSize} ${isBold ? 'font-bold' : ''} ${className}`,
        dir: 'auto', // Auto-detect direction for proper bidirectional text support (RTL/LTR)
        style: `text-align: ${align}`
      },
    },
  });

  React.useEffect(() => {
    if (!editor) return;

    const nextContent = content || '';
    if (nextContent === lastSyncedContentRef.current) {
      return;
    }

    const current = editor.getHTML();
    if (current !== nextContent) {
      editor.commands.setContent(nextContent, false);
    }
    lastSyncedContentRef.current = nextContent;
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const currentFontSize = editor.getAttributes('textStyle')?.fontSize
    ? editor.getAttributes('textStyle').fontSize.replace('px', '')
    : '16';

  const handleFontSizeChange = (value) => {
    if (!editor) return;
    editor.chain().setFontSize(`${value}px`).run();
    setFontMenuOpen(false);
  };

  return (
    <div className="relative">
      {/* Floating Toolbar */}
      {showToolbar && (
        <div className="absolute z-[100] left-1/2 transform -translate-x-1/2 top-[-44px] flex items-center gap-1 bg-popover border border-border rounded-lg p-1 shadow-xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
            className={`h-7 w-7 p-0 ${editor.isActive('bold') ? 'bg-accent' : ''} text-foreground hover:bg-accent`}
          >
            <Bold className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleItalic().run();
            }}
            className={`h-7 w-7 p-0 ${editor.isActive('italic') ? 'bg-accent' : ''} text-foreground hover:bg-accent`}
          >
            <Italic className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleUnderline().run();
            }}
            className={`h-7 w-7 p-0 ${editor.isActive('underline') ? 'bg-accent' : ''} text-foreground hover:bg-accent`}
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-5 bg-border mx-0.5" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().setTextAlign('left').run();
            }}
            className={`h-7 w-7 p-0 ${editor.isActive({ textAlign: 'left' }) ? 'bg-accent' : ''} text-foreground hover:bg-accent`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().setTextAlign('center').run();
            }}
            className={`h-7 w-7 p-0 ${editor.isActive({ textAlign: 'center' }) ? 'bg-accent' : ''} text-foreground hover:bg-accent`}
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().setTextAlign('right').run();
            }}
            className={`h-7 w-7 p-0 ${editor.isActive({ textAlign: 'right' }) ? 'bg-accent' : ''} text-foreground hover:bg-accent`}
          >
            <AlignRight className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <div className="flex items-center gap-0.5">
            <div className="flex items-center gap-1">
              <Popover open={fontMenuOpen} onOpenChange={(open) => {
                setFontMenuOpen(open);
                if (open) {
                  setShowToolbar(true);
                }
              }}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 flex items-center gap-1 text-foreground hover:bg-accent"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <Type className="w-3.5 h-3.5" />
                    <span className="text-xs">{currentFontSize}px</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="top"
                  sideOffset={6}
                  className="w-32 bg-popover border-border text-foreground p-2 space-y-1"
                  onOpenAutoFocus={(event) => event.preventDefault()}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  <div
                    className="max-h-48 overflow-y-auto"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {FONT_SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`w-full text-left px-2 py-1 rounded-md text-sm hover:bg-accent ${currentFontSize === size ? 'bg-accent text-accent-foreground' : ''}`}
                        onClick={() => handleFontSizeChange(size)}
                      >
                        {size}px
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="w-px h-5 bg-border mx-1" />
          <ColorButton
            icon={Palette}
            ariaLabel="Text color"
            color={editor.getAttributes('textStyle')?.color}
            onChange={(color) => editor.chain().focus().setColor(color).run()}
            onClear={() => editor.chain().focus().unsetColor().run()}
          />
          <div className="w-px h-5 bg-border mx-1" />
          <ColorButton
            icon={Highlighter}
            ariaLabel="Highlight color"
            color={editor.getAttributes('highlight')?.color}
            onChange={(color) => editor.chain().focus().setHighlight({ color }).run()}
            onClear={() => editor.chain().focus().unsetHighlight().run()}
            showOutline
          />
        </div>
      )}

      <EditorContent 
        editor={editor} 
        className="inline-rich-editor"
      />
    </div>
  );
};

const ColorButton = ({ icon: Icon, ariaLabel, color, onChange, onClear, showOutline = false }) => {
  const [open, setOpen] = React.useState(false);
  const safeColor = /^#([0-9A-F]{3}){1,2}$/i.test(color || '') ? color : '#FFFFFF';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 relative text-foreground hover:bg-accent ${color ? 'bg-accent/30' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={ariaLabel}
        >
          <Icon className="w-3.5 h-3.5" />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-border ${showOutline ? 'ring-1 ring-white/50' : ''}`}
            style={{ backgroundColor: color || 'transparent' }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 bg-popover border-border text-foreground space-y-3">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>{ariaLabel}</span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={safeColor}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            className="h-10 w-10 rounded border border-border bg-transparent cursor-pointer"
          />
          <div className="flex-1 space-y-1">
            <input
              type="text"
              value={color || ''}
              onChange={(event) => onChange(event.target.value)}
              placeholder="#FFFFFF"
              className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[11px] text-muted-foreground">Supports HEX colors</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default InlineRichEditor;
