import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { FontFamily } from '@tiptap/extension-font-family';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Underline as UnderlineIcon, Code, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Palette, Highlighter } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SURFACES, BORDERS } from '../../utils/designTokens';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

const RichTextEditor = ({
  content,
  onChange,
  placeholder,
  system = null,
  className = ''
}) => {
  const { t } = useTranslation();
  const translatedPlaceholder = placeholder || t('builder.placeholders.startTyping');
  const [showToolbar, setShowToolbar] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Use StarterKit's built-in extensions without duplicates
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          // Ensure links open in new tab for safety
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Placeholder.configure({
        placeholder: translatedPlaceholder,
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      setShowToolbar(!editor.state.selection.empty || focused);
    },
    onFocus: () => {
      setFocused(true);
      setShowToolbar(true);
    },
    onBlur: () => {
      setFocused(false);
      setShowToolbar(false);
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose max-w-none focus:outline-none min-h-[120px] p-6 text-foreground',
          'prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground',
          'prose-a:text-current prose-code:text-current',
          system && getProseClasses(system)
        ),
        dir: 'auto'
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

  // Get content-type specific prose styling
  const getProseClasses = (systemType) => {
    const proseMap = {
      policy: 'prose-headings:text-amber-100 prose-p:text-amber-50/90',
      procedure: 'prose-headings:text-cyan-100 prose-p:text-cyan-50/90',
      documentation: 'prose-headings:text-purple-100 prose-p:text-purple-50/90',
      faq: 'prose-headings:text-emerald-100 prose-p:text-emerald-50/90',
      decisionTree: 'prose-headings:text-indigo-100 prose-p:text-indigo-50/90'
    };
    return proseMap[systemType] || '';
  };

  // Get glass surface styling for the editor
  const getEditorSurface = () => {
    if (system) {
      return cn(
        SURFACES.glass.secondary,
        BORDERS.glass.primary,
        'transition-all duration-300',
        focused && `${BORDERS.interactive.focus} ring-2 ring-white/10`
      );
    }
    return 'bg-slate-800/50 border border-slate-600 rounded-xl';
  };

  return (
    <motion.div
      className={cn('relative rounded-xl overflow-visible', getEditorSurface(), className)}
      initial={{ opacity: 0.9 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Subtle inner gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />

      {/* Rich text hint when focused */}
      {focused && editor.state.selection.empty && (
        <div className="absolute top-2 right-2 text-xs text-white/60 bg-slate-800/80 px-2 py-1 rounded-md pointer-events-none">
          Select text for formatting options
        </div>
      )}

      {/* Enhanced Floating Toolbar - positioned inside container */}
      <AnimatePresence>
        {showToolbar && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-[9999] left-1/2 transform -translate-x-1/2 bottom-full mb-2 flex items-center gap-1 bg-slate-900 backdrop-blur-xl rounded-xl p-2 shadow-2xl border-2 border-white/20"
            style={{ minWidth: 'fit-content' }}
          >
            {/* Test indicator */}
            <div className="text-xs text-white/60 px-2 py-1 bg-slate-700 rounded mr-2">
              Rich Text Toolbar
            </div>

            {/* Formatting buttons */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
              icon={Bold}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
              icon={Italic}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              active={editor.isActive('underline')}
              icon={UnderlineIcon}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              active={editor.isActive('code')}
              icon={Code}
            />

            <div className="w-px h-6 bg-white/20 mx-1" />

            {/* Alignment buttons */}
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              active={editor.isActive({ textAlign: 'left' })}
              icon={AlignLeft}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              active={editor.isActive({ textAlign: 'center' })}
              icon={AlignCenter}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              active={editor.isActive({ textAlign: 'right' })}
              icon={AlignRight}
            />

            <div className="w-px h-6 bg-white/20 mx-1" />

            {/* List buttons */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
              icon={List}
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')}
              icon={ListOrdered}
            />
            <ToolbarButton
              onClick={setLink}
              active={editor.isActive('link')}
              icon={LinkIcon}
            />

            <div className="w-px h-6 bg-white/20 mx-1" />

            <ColorPopoverButton
              label={t('builder.richText.textColor') || 'Text Color'}
              icon={Palette}
              color={editor.getAttributes('textStyle')?.color}
              onClear={() => editor.chain().focus().unsetColor().run()}
              onChange={(color) => editor.chain().focus().setColor(color).run()}
            />

            <div className="w-px h-6 bg-white/20 mx-1" />

            <ColorPopoverButton
              label={t('builder.richText.highlightColor') || 'Highlight Color'}
              icon={Highlighter}
              color={editor.getAttributes('highlight')?.color}
              onClear={() => editor.chain().focus().unsetHighlight().run()}
              onChange={(color) => editor.chain().focus().setHighlight({ color }).run()}
              showOutline
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <EditorContent editor={editor} />
      </div>
    </motion.div>
  );
};

// Enhanced Toolbar Button Component
const ToolbarButton = ({ onClick, active, icon: Icon }) => (
  <motion.button
    type="button"
    onClick={onClick}
    className={cn(
      'h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-200',
      'hover:bg-white/10 text-white/80 hover:text-white',
      active && 'bg-white/20 text-white shadow-lg'
    )}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    <Icon className="w-4 h-4" />
  </motion.button>
);

const ColorPopoverButton = ({ label, icon: Icon, color, onChange, onClear, showOutline = false }) => {
  const [open, setOpen] = React.useState(false);
  const safeColor = /^#([0-9A-F]{3}){1,2}$/i.test(color || '') ? color : '#FFFFFF';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          className={cn(
            'relative h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-200',
            'hover:bg-white/10 text-white/80 hover:text-white',
            (color || showOutline) && 'bg-white/10 text-white'
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Icon className="w-4 h-4" />
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-white/40',
              showOutline && 'ring-1 ring-white/60'
            )}
            style={{ backgroundColor: color || 'transparent' }}
          />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent className="w-56 bg-slate-900 border border-white/20 text-white space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <button
            type="button"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className="text-xs text-white/60 hover:text-white"
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
            className="h-10 w-10 rounded border border-white/30 bg-transparent cursor-pointer"
          />
          <div className="flex-1">
            <input
              type="text"
              value={color || ''}
              onChange={(event) => onChange(event.target.value)}
              placeholder="#FFFFFF"
              className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-white/50"
            />
            <p className="text-[11px] text-white/50 mt-1">Supports HEX colors</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default RichTextEditor;