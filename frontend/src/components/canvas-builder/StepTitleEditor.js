import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';

const StepTitleEditor = ({ title, onChange, isRTL = false }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2],
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'שם השלב',
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
    ],
    content: title ? {
      type: 'heading',
      attrs: { level: 2, textAlign: 'center' },
      content: [{ type: 'text', text: title }]
    } : {
      type: 'heading',
      attrs: { level: 2, textAlign: 'center' },
      content: []
    },
    onUpdate: ({ editor }) => {
      // Preserve spaces (including trailing spaces) better than editor.getText()
      const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\0');
      onChange(text);
    },
    editorProps: {
      attributes: {
        class: 'text-4xl font-heading font-bold text-slate-900 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded px-4 py-2',
        dir: isRTL ? 'rtl' : 'ltr'
      },
    },
  });

  // Ensure center alignment persists on mount and when title changes
  useEffect(() => {
    if (editor) {
      // Set center alignment if not already set
      if (!editor.isActive({ textAlign: 'center' })) {
        editor.chain().setTextAlign('center').run();
      }
    }
  }, [editor, title]);

  if (!editor) {
    return null;
  }

  return <EditorContent editor={editor} />;
};

export default StepTitleEditor;
