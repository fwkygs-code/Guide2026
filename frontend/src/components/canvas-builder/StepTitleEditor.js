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
    content: {
      type: 'heading',
      attrs: { level: 2, textAlign: 'center' },
      content: title ? [{ type: 'text', text: title }] : []
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

  // Ensure center alignment persists
  useEffect(() => {
    if (editor && !editor.isActive({ textAlign: 'center' })) {
      editor.chain().focus().setTextAlign('center').run();
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  return <EditorContent editor={editor} />;
};

export default StepTitleEditor;
