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
        dir: isRTL ? 'rtl' : 'ltr',
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                const currentSize = editor.getAttributes('textStyle').fontSize || '16px';
                const sizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
                const currentIndex = sizes.indexOf(currentSize);
                const nextIndex = (currentIndex + 1) % sizes.length;
                editor.chain().focus().setFontSize(sizes[nextIndex]).run();
              }}
              className="h-7 px-2 text-white hover:bg-slate-700 text-xs"
              title="Font Size"
            >
              <Type className="w-3 h-3 mr-1" />
              <span className="text-[10px]">
                {editor.getAttributes('textStyle').fontSize || '16px'}
              </span>
            </Button>
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
