import React, { createContext, useContext, useState, useEffect } from 'react';

const TextSizeContext = createContext();

export const useTextSize = () => {
  const context = useContext(TextSizeContext);
  if (!context) {
    throw new Error('useTextSize must be used within a TextSizeProvider');
  }
  return context;
};

export const TextSizeProvider = ({ children }) => {
  const [textSize, setTextSize] = useState(() => {
    // Load from localStorage or default to 'medium'
    const saved = localStorage.getItem('textSize');
    return saved || 'medium';
  });

  useEffect(() => {
    // Save to localStorage whenever it changes
    localStorage.setItem('textSize', textSize);
    // Apply to document root for CSS variables
    document.documentElement.setAttribute('data-text-size', textSize);
  }, [textSize]);

  const textSizeClasses = {
    small: {
      base: 'text-sm',
      heading: 'text-base',
      title: 'text-lg',
      large: 'text-xl',
      xl: 'text-2xl',
      '2xl': 'text-3xl',
      input: 'text-sm',
      button: 'text-sm',
      label: 'text-xs'
    },
    medium: {
      base: 'text-base',
      heading: 'text-lg',
      title: 'text-xl',
      large: 'text-2xl',
      xl: 'text-3xl',
      '2xl': 'text-4xl',
      input: 'text-base',
      button: 'text-base',
      label: 'text-sm'
    },
    large: {
      base: 'text-lg',
      heading: 'text-xl',
      title: 'text-2xl',
      large: 'text-3xl',
      xl: 'text-4xl',
      '2xl': 'text-5xl',
      input: 'text-lg',
      button: 'text-lg',
      label: 'text-base'
    },
    xl: {
      base: 'text-xl',
      heading: 'text-2xl',
      title: 'text-3xl',
      large: 'text-4xl',
      xl: 'text-5xl',
      '2xl': 'text-6xl',
      input: 'text-xl',
      button: 'text-xl',
      label: 'text-lg'
    }
  };

  const getSizeClass = (type = 'base') => {
    return textSizeClasses[textSize]?.[type] || textSizeClasses[textSize].base;
  };

  return (
    <TextSizeContext.Provider value={{ textSize, setTextSize, getSizeClass, textSizeClasses }}>
      {children}
    </TextSizeContext.Provider>
  );
};
