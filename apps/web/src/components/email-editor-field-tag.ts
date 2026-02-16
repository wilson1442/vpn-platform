import { Node, mergeAttributes } from '@tiptap/react';

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    fieldTag: {
      insertFieldTag: (key: string) => ReturnType;
    };
  }
}

export const FieldTag = Node.create({
  name: 'fieldTag',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      key: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-field-tag]',
        getAttrs: (el) => {
          const element = el as HTMLElement;
          return { key: element.getAttribute('data-field-tag') };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-field-tag': node.attrs.key,
        class: 'field-tag',
      }),
      `{{${node.attrs.key}}}`,
    ];
  },

  renderText({ node }) {
    return `{{${node.attrs.key}}}`;
  },

  addCommands() {
    return {
      insertFieldTag:
        (key: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { key },
          });
        },
    };
  },
});
