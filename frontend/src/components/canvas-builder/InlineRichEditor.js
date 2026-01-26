import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FontSize } from '@/lib/fontSize';

function getEditorPlainText(editor) {
  // Preserve spaces (including trailing) better than HTML/textContent which can drop/collapse them.
  return editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\0');
}

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
      onChange(editor.getHTML());
    },
    onFocus: () => {
      setShowToolbar(true);
    },
    onBlur: ({ event }) => {
      // Delay hiding toolbar to allow button clicks
      setTimeout(() => {
        setShowToolbar(false);
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

    const current = editor.getHTML();
    // If content is HTML, use it directly; otherwise treat as plain text
    const contentToSet = (content || '').trim();
    if (contentToSet && contentToSet !== current) {
      // If content looks like HTML (contains tags), use it as-is
      // Otherwise, set as plain text
      if (contentToSet.startsWith('<') || contentToSet.includes('<')) {
        editor.commands.setContent(contentToSet, false);
      } else {
        editor.commands.setContent(contentToSet, false);
      }
    } else if (!contentToSet && current) {
      editor.commands.setContent('', false);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

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
          <div className="w-px h-5 bg-border mx-0.5" />
          <div className="flex items-center gap-0.5">
            <div className="flex items-center gap-1">
              <Type className="w-3.5 h-3.5 text-foreground" />
              <Select
                value={editor.getAttributes('textStyle').fontSize ? editor.getAttributes('textStyle').fontSize.replace('px', '') : '16'}
                onValueChange={(value) => {
                  editor.chain().focus().setFontSize(`${value}px`).run();
                }}
              >
                <SelectTrigger 
                  className="h-7 w-20 bg-secondary border-border text-foreground text-xs hover:bg-accent focus:ring-ring"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground z-[101]" side="top">
                  <SelectItem value="12" className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer">12px</SelectItem>
                  <SelectItem value="14" className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer">14px</SelectItem>
                  <SelectItem value="16" className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer">16px</SelectItem>
                  <SelectItem value="18" className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer">18px</SelectItem>
                  <SelectItem value="20" className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer">20px</SelectItem>
                  <SelectItem value="24" className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer">24px</SelectItem>
                  <SelectItem value="28" className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer">28px</SelectItem>
                  <SelectItem value="32" className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer">32px</SelectItem>
                  <SelectItem value="36" className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer">36px</SelectItem>
                  <SelectItem value="40" className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer">40px</SelectItem>
                  <SelectItem value="48" className="text-foreground hover:bg-accent focus:bg-accent cursor-pointer">48px</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <EditorContent 
        editor={editor} 
        className="inline-rich-editor"
      />
    </div>
  );
};

export default InlineRichEditor;
