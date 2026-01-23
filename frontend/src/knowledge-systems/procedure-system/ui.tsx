// Procedure System - Isolated UI Primitives
// No shared components, no external imports except React

import React from 'react';

// Procedure-specific Button component
export function Button({ children, onClick, className = '', variant = 'default', disabled = false, ...props }: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  disabled?: boolean;
  [key: string]: any;
}) {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variantClasses = {
    default: 'bg-cyan-600 hover:bg-cyan-700 text-white focus:ring-cyan-500',
    outline: 'border border-cyan-300 text-cyan-100 hover:bg-cyan-50 hover:text-cyan-900',
    ghost: 'text-cyan-100 hover:bg-cyan-50 hover:text-cyan-900'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// Procedure-specific Input component
export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      className={`w-full px-3 py-2 bg-slate-800 border border-cyan-300 rounded-md text-white placeholder:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${className}`}
      {...props}
    />
  );
}

// Procedure-specific Textarea component
export function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return (
    <textarea
      className={`w-full px-3 py-2 bg-slate-800 border border-cyan-300 rounded-md text-white placeholder:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${className}`}
      {...props}
    />
  );
}

// Procedure-specific Label component
export function Label({ children, className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm font-medium text-cyan-100 ${className}`} {...props}>
      {children}
    </label>
  );
}

// Procedure-specific Card components
export function Card({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={`bg-gradient-to-br from-cyan-500/10 to-slate-800/50 backdrop-blur-sm border border-cyan-500/20 rounded-xl ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={`p-6 border-b border-cyan-500/20 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement> & { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-2xl font-bold text-cyan-100 ${className}`} {...props}>
      {children}
    </h3>
  );
}

// Procedure-specific Badge component
export function Badge({ children, className = '', variant = 'default' }: { children: React.ReactNode; className?: string; variant?: 'default' | 'secondary' }) {
  const variantClasses = {
    default: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
    secondary: 'bg-slate-700 text-slate-300 border border-slate-600'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

// Procedure-specific motion utilities (no framer-motion)
export function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      style={{
        animation: `procedureFadeIn 0.5s ease-out ${delay}ms both`
      }}
    >
      {children}
    </div>
  );
}

// CSS-in-JS animation
const styles = `
  @keyframes procedureFadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}