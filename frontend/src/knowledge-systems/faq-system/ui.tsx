// Policy System - Isolated UI Primitives
// No shared components, no external imports except React

import React from 'react';

// Policy-specific Button component
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
    default: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
    outline: 'border border-amber-300 text-amber-100 hover:bg-amber-50 hover:text-amber-900',
    ghost: 'text-amber-100 hover:bg-amber-50 hover:text-amber-900'
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

// Policy-specific Input component
export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      className={`w-full px-3 py-2 bg-slate-800 border border-amber-300 rounded-md text-white placeholder:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 ${className}`}
      {...props}
    />
  );
}

// Policy-specific Textarea component
export function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return (
    <textarea
      className={`w-full px-3 py-2 bg-slate-800 border border-amber-300 rounded-md text-white placeholder:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 ${className}`}
      {...props}
    />
  );
}

// Policy-specific Label component
export function Label({ children, className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm font-medium text-amber-100 ${className}`} {...props}>
      {children}
    </label>
  );
}

// Policy-specific Card components
export function Card({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={`bg-gradient-to-br from-amber-500/10 to-slate-800/50 backdrop-blur-sm border border-amber-500/20 rounded-xl ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={`p-6 border-b border-amber-500/20 ${className}`} {...props}>
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
    <h3 className={`text-2xl font-bold text-amber-100 ${className}`} {...props}>
      {children}
    </h3>
  );
}

// Policy-specific Badge component
export function Badge({ children, className = '', variant = 'default' }: { children: React.ReactNode; className?: string; variant?: 'default' | 'secondary' }) {
  const variantClasses = {
    default: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    secondary: 'bg-slate-700 text-slate-300 border border-slate-600'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

// Policy-specific motion utilities (no framer-motion)
export function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      style={{
        animation: `fadeIn 0.5s ease-out ${delay}ms both`
      }}
    >
      {children}
    </div>
  );
}

// CSS-in-JS animation
const styles = `
  @keyframes fadeIn {
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