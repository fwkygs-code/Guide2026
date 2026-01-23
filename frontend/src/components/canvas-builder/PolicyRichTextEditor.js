/**
 * PolicyRichTextEditor - Authoritative Document Editor
 *
 * Specialized rich text editor for legal/compliance content.
 * Emphasizes formal language, structure, and official tone.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  FileText,
  Scale
} from 'lucide-react';

/**
 * PolicyRichTextEditor - Specialized for legal content
 *
 * Features:
 * - Formal headings (H1, H2 only - no H3+ for legal structure)
 * - Quote blocks for citations/legal references
 * - Bold/Italic/Underline for emphasis
 * - Numbered lists for procedural steps
 * - Bulleted lists for requirements
 * - No inline code or links (not typical in policies)
 */
export function PolicyRichTextEditor({ content, onChange, placeholder, className }) {
  const editorRef = useRef(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = content || '';
    }
  }, [content]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertQuote = () => {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const quote = document.createElement('blockquote');
    quote.className = 'border-l-4 border-amber-500/50 pl-4 italic text-amber-100/80 my-4';
    quote.textContent = 'Enter citation or legal reference...';

    range.deleteContents();
    range.insertNode(quote);

    // Select the quote content for editing
    const newRange = document.createRange();
    newRange.selectNodeContents(quote);
    selection.removeAllRanges();
    selection.addRange(newRange);

    handleInput();
  };

  const isCommandActive = (command) => {
    return document.queryCommandState(command);
  };

  return (
    <div className={cn('border border-slate-600/50 rounded-lg overflow-hidden', className)}>
      {/* Toolbar - Formal legal styling */}
      <div className="bg-slate-800/50 border-b border-slate-600/30 p-2 flex flex-wrap gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('bold') && 'bg-amber-500/20 text-amber-300'
          )}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('italic')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('italic') && 'bg-amber-500/20 text-amber-300'
          )}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('underline')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('underline') && 'bg-amber-500/20 text-amber-300'
          )}
          title="Underline (Ctrl+U)"
        >
          <Underline className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-slate-600/50 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('insertUnorderedList') && 'bg-amber-500/20 text-amber-300'
          )}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertOrderedList')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('insertOrderedList') && 'bg-amber-500/20 text-amber-300'
          )}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-slate-600/50 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('formatBlock', 'h1')}
          className="h-8 w-8 p-0"
          title="Section Heading"
        >
          <Heading1 className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('formatBlock', 'h2')}
          className="h-8 w-8 p-0"
          title="Subsection Heading"
        >
          <Heading2 className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-slate-600/50 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={insertQuote}
          className="h-8 w-8 p-0"
          title="Legal Citation"
        >
          <Quote className="w-4 h-4" />
        </Button>
      </div>

      {/* Editor Content */}
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[120px] p-4 text-slate-200 focus:outline-none prose prose-invert max-w-none"
        onInput={handleInput}
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
        style={{
          // Policy-specific typography
          fontFamily: 'Georgia, "Times New Roman", serif',
          lineHeight: '1.6',
          fontSize: '16px'
        }}
      />

      {/* Status indicator */}
      <div className="px-4 py-2 bg-slate-800/30 border-t border-slate-600/30 flex items-center gap-2 text-xs text-slate-400">
        <FileText className="w-3 h-3" />
        <span>Policy Document Editor</span>
        <Scale className="w-3 h-3 ml-auto" />
        <span>Legal Content</span>
      </div>
    </div>
  );
}

export default PolicyRichTextEditor;