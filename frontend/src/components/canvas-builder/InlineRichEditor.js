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
        <div className="absolute z-[100] left-1/2 transform -translate-x-1/2 top-[-44px] flex items-center gap-1 bg-slate-900 rounded-lg p-1 shadow-xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
            className={`h-7 w-7 p-0 ${editor.isActive('bold') ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
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
            className={`h-7 w-7 p-0 ${editor.isActive('italic') ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
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
            className={`h-7 w-7 p-0 ${editor.isActive('underline') ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-5 bg-slate-700 mx-0.5" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().setTextAlign('left').run();
            }}
            className={`h-7 w-7 p-0 ${editor.isActive({ textAlign: 'left' }) ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
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
            className={`h-7 w-7 p-0 ${editor.isActive({ textAlign: 'center' }) ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
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
            className={`h-7 w-7 p-0 ${editor.isActive({ textAlign: 'right' }) ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <AlignRight className="w-3.5 h-3.5" />
          </Button>
          <div className="w-px h-5 bg-slate-700 mx-0.5" />
          <div className="flex items-center gap-0.5">
            <div className="flex items-center gap-1">
              <Type className="w-3.5 h-3.5 text-white" />
              <Select
                value={editor.getAttributes('textStyle').fontSize ? editor.getAttributes('textStyle').fontSize.replace('px', '') : '16'}
                onValueChange={(value) => {
                  editor.chain().focus().setFontSize(`${value}px`).run();
                }}
              >
                <SelectTrigger 
                  className="h-7 w-20 bg-slate-800 border-slate-700 text-white text-xs hover:bg-slate-700 focus:ring-slate-600"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white z-[101]" side="top">
                  <SelectItem value="12" className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">12px</SelectItem>
                  <SelectItem value="14" className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">14px</SelectItem>
                  <SelectItem value="16" className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">16px</SelectItem>
                  <SelectItem value="18" className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">18px</SelectItem>
                  <SelectItem value="20" className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">20px</SelectItem>
                  <SelectItem value="24" className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">24px</SelectItem>
                  <SelectItem value="28" className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">28px</SelectItem>
                  <SelectItem value="32" className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">32px</SelectItem>
                  <SelectItem value="36" className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">36px</SelectItem>
                  <SelectItem value="40" className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">40px</SelectItem>
                  <SelectItem value="48" className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">48px</SelectItem>
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
