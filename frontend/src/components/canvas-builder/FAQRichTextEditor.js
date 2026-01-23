/**
 * FAQRichTextEditor - Clear Communication Editor
 *
 * Specialized rich text editor for Q&A content.
 * Emphasizes clarity, simplicity, and user-friendly formatting.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link,
  HelpCircle,
  MessageSquare,
  Lightbulb
} from 'lucide-react';

/**
 * FAQRichTextEditor - Specialized for clear Q&A communication
 *
 * Features:
 * - Bold/Italic for emphasis
 * - Simple lists for step-by-step answers
 * - Links for additional resources
 * - Lightbulb callouts for tips
 * - Minimal formatting to maintain clarity
 * - No complex hierarchies or code blocks
 */
export function FAQRichTextEditor({ content, onChange, placeholder, className }) {
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

  const insertTip = () => {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    const tip = document.createElement('div');
    tip.className = 'flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 my-3';
    tip.innerHTML = `
      <div class="flex-shrink-0 mt-0.5 text-emerald-400">💡</div>
      <div class="flex-1 text-emerald-100">Pro tip: Add helpful advice here.</div>
    `;

    range.deleteContents();
    range.insertNode(tip);
    handleInput();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const isCommandActive = (command) => {
    return document.queryCommandState(command);
  };

  return (
    <div className={cn('border border-slate-600/50 rounded-lg overflow-hidden', className)}>
      {/* Toolbar - Simple and clear */}
      <div className="bg-slate-800/50 border-b border-slate-600/30 p-2 flex flex-wrap gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('bold') && 'bg-emerald-500/20 text-emerald-300'
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
            isCommandActive('italic') && 'bg-emerald-500/20 text-emerald-300'
          )}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-slate-600/50 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('insertUnorderedList') && 'bg-emerald-500/20 text-emerald-300'
          )}
          title="Bullet Points"
        >
          <List className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertOrderedList')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('insertOrderedList') && 'bg-emerald-500/20 text-emerald-300'
          )}
          title="Numbered Steps"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-slate-600/50 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={insertLink}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('createLink') && 'bg-emerald-500/20 text-emerald-300'
          )}
          title="Add Link"
        >
          <Link className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={insertTip}
          className="h-8 w-8 p-0"
          title="Add Tip"
        >
          <Lightbulb className="w-4 h-4" />
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
          // FAQ-specific typography - clear and approachable
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: '1.5',
          fontSize: '16px'
        }}
      />

      {/* Status indicator */}
      <div className="px-4 py-2 bg-slate-800/30 border-t border-slate-600/30 flex items-center gap-2 text-xs text-slate-400">
        <MessageSquare className="w-3 h-3" />
        <span>FAQ Answer Editor</span>
        <HelpCircle className="w-3 h-3 ml-auto" />
        <span>Clear Communication</span>
      </div>
    </div>
  );
}

export default FAQRichTextEditor;