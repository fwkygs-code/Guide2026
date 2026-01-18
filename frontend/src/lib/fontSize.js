import { Extension } from '@tiptap/core';
import { TextStyle } from '@tiptap/extension-text-style';

export const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: element => element.style.fontSize?.replace('px', '') || null,
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
      setFontSize: (fontSize) => ({ chain }) => {
        return chain()
          .setMark(this.name, { fontSize: fontSize.replace('px', '') })
          .run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark(this.name, { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});
