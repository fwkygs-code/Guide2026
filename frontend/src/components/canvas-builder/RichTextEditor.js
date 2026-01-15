import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Underline as UnderlineIcon, Code, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, List, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RichTextEditor = ({ content, onChange, placeholder = 'Start typing...', isRTL = false }) => {
  const [showToolbar, setShowToolbar] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      setShowToolbar(!editor.state.selection.empty);
    },
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[100px] p-4',
        dir: isRTL ? 'rtl' : 'ltr'
      },
    },
  });

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg bg-white relative">
      {/* Floating Toolbar */}
      {showToolbar && !editor.state.selection.empty && (
        <div className="absolute z-[100] left-1/2 transform -translate-x-1/2 top-[-48px] flex items-center gap-1 bg-slate-900 rounded-lg p-1 shadow-xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('underline') ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <UnderlineIcon className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('code') ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <Code className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-slate-700 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'left' }) ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'center' }) ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'right' }) ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <AlignRight className="w-4 h-4" />
          </Button>
          <div className="w-px h-6 bg-slate-700 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('bulletList') ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('orderedList') ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={setLink}
            className={`h-8 w-8 p-0 ${editor.isActive('link') ? 'bg-slate-700' : ''} text-white hover:bg-slate-700`}
          >
            <LinkIcon className="w-4 h-4" />
          </Button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
