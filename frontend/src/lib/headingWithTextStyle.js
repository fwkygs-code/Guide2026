import Heading from '@tiptap/extension-heading';
import { TextStyle } from '@tiptap/extension-text-style';

// Extended Heading that allows TextStyle marks (for FontSize, Color, etc.)
export const HeadingWithTextStyle = Heading.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      // Allow textStyle marks inside headings
      marks: '',
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      // Ensure heading can accept textStyle marks
    };
  },

  // Allow textStyle marks to be applied to heading content
  markdownOptions: {
    ...this.parent?.()?.markdownOptions,
  },
});

// Configure to explicitly allow textStyle marks
HeadingWithTextStyle.configure({
  HTMLAttributes: {
    class: 'heading-with-text-style',
  },
});
