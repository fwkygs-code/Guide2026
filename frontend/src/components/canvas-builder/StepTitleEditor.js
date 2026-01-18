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
      // Save HTML to preserve alignment and formatting
      const html = editor.getHTML();
      // Extract text for backward compatibility, but ensure center alignment is always applied
      const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\0');
      // Force center alignment on every update
      if (!editor.isActive({ textAlign: 'center' })) {
        editor.chain().setTextAlign('center').run();
      }
      onChange(text);
    },
    editorProps: {
      attributes: {
        class: 'text-4xl font-heading font-bold text-slate-900 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded px-4 py-2',
        dir: isRTL ? 'rtl' : 'ltr'
      },
    },
  });

  // CRITICAL: Ensure center alignment persists on mount and when title changes
  // This is the root cause fix - alignment must be applied every time content is set
  useEffect(() => {
    if (!editor || title === undefined) return;
    
    const currentText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\0');
    
    // If title changed, update content WITH center alignment
    if (currentText !== title) {
      // Set content with explicit center alignment attribute
      editor.commands.setContent({
        type: 'heading',
        attrs: { level: 2, textAlign: 'center' },
        content: title ? [{ type: 'text', text: title }] : []
      }, false);
    }
    
    // CRITICAL: Always force center alignment after content is set
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      if (editor && !editor.isActive({ textAlign: 'center' })) {
        editor.chain().focus().setTextAlign('center').run();
      }
    });
  }, [editor, title]);

  if (!editor) {
    return null;
  }

  return <EditorContent editor={editor} />;
};

export default StepTitleEditor;
