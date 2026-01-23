/**
 * ProcedureRichTextEditor - Workflow Documentation Editor
 *
 * Specialized rich text editor for procedural/workflow content.
 * Emphasizes clarity, sequencing, and operational precision.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  CheckSquare,
  AlertTriangle,
  Zap,
  ArrowRight,
  FileText
} from 'lucide-react';

/**
 * ProcedureRichTextEditor - Specialized for workflow documentation
 *
 * Features:
 * - Bold/Italic for emphasis
 * - Numbered lists for sequential steps
 * - CheckSquare for verification points
 * - AlertTriangle for warnings/cautions
 * - Zap for important notes
 * - ArrowRight for transitions
 * - No complex formatting - keeps focus on clarity
 */
export function ProcedureRichTextEditor({ content, onChange, placeholder, className }) {
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

  const insertCallout = (type, icon, defaultText) => {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    const callout = document.createElement('div');
    callout.className = `flex items-start gap-3 p-3 rounded-lg border my-3 ${
      type === 'warning' ? 'bg-red-500/10 border-red-500/30 text-red-200' :
      type === 'important' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-200' :
      type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-200' :
      'bg-blue-500/10 border-blue-500/30 text-blue-200'
    }`;

    callout.innerHTML = `
      <div class="flex-shrink-0 mt-0.5">${icon}</div>
      <div class="flex-1">${defaultText}</div>
    `;

    range.deleteContents();
    range.insertNode(callout);
    handleInput();
  };

  const isCommandActive = (command) => {
    return document.queryCommandState(command);
  };

  return (
    <div className={cn('border border-slate-600/50 rounded-lg overflow-hidden', className)}>
      {/* Toolbar - Workflow-focused */}
      <div className="bg-slate-800/50 border-b border-slate-600/30 p-2 flex flex-wrap gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('bold') && 'bg-cyan-500/20 text-cyan-300'
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
            isCommandActive('italic') && 'bg-cyan-500/20 text-cyan-300'
          )}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-slate-600/50 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertOrderedList')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('insertOrderedList') && 'bg-cyan-500/20 text-cyan-300'
          )}
          title="Numbered Steps"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('insertUnorderedList') && 'bg-cyan-500/20 text-cyan-300'
          )}
          title="Bullet Points"
        >
          <List className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-slate-600/50 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertCallout('success', '✅', 'Verification step: Confirm completion before proceeding.')}
          className="h-8 w-8 p-0"
          title="Success Callout"
        >
          <CheckSquare className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertCallout('warning', '⚠️', 'Caution: Ensure safety protocols are followed.')}
          className="h-8 w-8 p-0"
          title="Warning Callout"
        >
          <AlertTriangle className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertCallout('important', '⚡', 'Important: This step is critical for success.')}
          className="h-8 w-8 p-0"
          title="Important Callout"
        >
          <Zap className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => insertCallout('info', '→', 'Next: Proceed to the following step.')}
          className="h-8 w-8 p-0"
          title="Transition Callout"
        >
          <ArrowRight className="w-4 h-4" />
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
          // Procedure-specific typography - clear and readable
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: '1.5',
          fontSize: '15px'
        }}
      />

      {/* Status indicator */}
      <div className="px-4 py-2 bg-slate-800/30 border-t border-slate-600/30 flex items-center gap-2 text-xs text-slate-400">
        <FileText className="w-3 h-3" />
        <span>Procedure Documentation Editor</span>
        <Zap className="w-3 h-3 ml-auto" />
        <span>Workflow Content</span>
      </div>
    </div>
  );
}

export default ProcedureRichTextEditor;