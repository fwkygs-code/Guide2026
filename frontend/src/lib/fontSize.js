import { TextStyle } from '@tiptap/extension-text-style';

export const FontSize = TextStyle.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      types: ['textStyle', 'heading'], // Allow fontSize in both textStyle marks and heading nodes
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: element => {
          const fontSize = element.style.fontSize;
          if (!fontSize) return null;
          // Extract numeric value (remove 'px', 'em', etc.)
          const match = fontSize.match(/(\d+(?:\.\d+)?)/);
          return match ? match[1] : null;
        },
        renderHTML: attributes => {
          if (!attributes.fontSize) {
            return {};
          }
          return {
            style: `font-size: ${attributes.fontSize}px`,
          };
        },
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize: (fontSize) => ({ chain, state }) => {
        // Extract numeric value from fontSize string (e.g., "16px" -> "16")
        const sizeValue = fontSize.toString().replace(/px|em|rem|%/i, '').trim();
        
        // Set the mark on 'textStyle' (the mark name, not the extension name)
        return chain()
          .focus()
          .setMark('textStyle', { fontSize: sizeValue })
          .run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .focus()
          .removeMark('textStyle')
          .run();
      },
    };
  },
});
