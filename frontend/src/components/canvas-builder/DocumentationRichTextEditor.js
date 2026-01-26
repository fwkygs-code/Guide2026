/**
 * DocumentationRichTextEditor - Technical Knowledge Editor
 *
 * Specialized rich text editor for technical documentation.
 * Supports code blocks, links, and structured technical content.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Code,
  Link,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  FileCode,
  Terminal,
  ExternalLink
} from 'lucide-react';

/**
 * DocumentationRichTextEditor - Specialized for technical content
 *
 * Features:
 * - Full heading hierarchy (H1, H2, H3) for technical structure
 * - Code blocks and inline code for technical content
 * - Links for cross-references and external resources
 * - Quote blocks for examples or notes
 * - Lists for procedures and specifications
 */
export function DocumentationRichTextEditor({ content, onChange, placeholder, className }) {
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

  const insertCodeBlock = () => {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);

    const codeBlock = document.createElement('pre');
    codeBlock.className = 'bg-secondary border border-border rounded p-3 my-3 overflow-x-auto';
    const code = document.createElement('code');
    code.className = 'text-green-400 font-mono text-sm';
    code.textContent = '// Enter code here...';

    codeBlock.appendChild(code);

    range.deleteContents();
    range.insertNode(codeBlock);

    // Select the code content for editing
    const newRange = document.createRange();
    newRange.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(newRange);

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
    <div className={cn('border border-border rounded-lg overflow-hidden', className)}>
      {/* Toolbar - Technical documentation focused */}
      <div className="bg-secondary border-b border-border p-2 flex flex-wrap gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('bold') && 'bg-purple-500/20 text-purple-300'
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
            isCommandActive('italic') && 'bg-purple-500/20 text-purple-300'
          )}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('formatBlock', 'code')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('formatBlock', 'code') && 'bg-purple-500/20 text-purple-300'
          )}
          title="Inline Code"
        >
          <Code className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('insertUnorderedList') && 'bg-purple-500/20 text-purple-300'
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
            isCommandActive('insertOrderedList') && 'bg-purple-500/20 text-purple-300'
          )}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('formatBlock', 'h1')}
          className="h-8 w-8 p-0"
          title="Main Section"
        >
          <Heading1 className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('formatBlock', 'h2')}
          className="h-8 w-8 p-0"
          title="Subsection"
        >
          <Heading2 className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('formatBlock', 'h3')}
          className="h-8 w-8 p-0"
          title="Sub-subsection"
        >
          <Heading3 className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => execCommand('formatBlock', 'blockquote')}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('formatBlock', 'blockquote') && 'bg-purple-500/20 text-purple-300'
          )}
          title="Quote/Note"
        >
          <Quote className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={insertCodeBlock}
          className="h-8 w-8 p-0"
          title="Code Block"
        >
          <FileCode className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={insertLink}
          className={cn(
            'h-8 w-8 p-0',
            isCommandActive('createLink') && 'bg-purple-500/20 text-purple-300'
          )}
          title="Insert Link"
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>

      {/* Editor Content */}
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[120px] p-4 text-foreground focus:outline-none prose prose-invert max-w-none"
        onInput={handleInput}
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
        style={{
          // Documentation-specific typography
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: '1.6',
          fontSize: '15px'
        }}
      />

      {/* Status indicator */}
      <div className="px-4 py-2 bg-secondary border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
        <FileCode className="w-3 h-3" />
        <span>Technical Documentation Editor</span>
        <Terminal className="w-3 h-3 ml-auto" />
        <span>Code & Reference Content</span>
      </div>
    </div>
  );
}

export default DocumentationRichTextEditor;