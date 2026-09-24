"use client";

import { EditorContent, useEditor, useEditorState, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";

export type EditorHandle = TiptapEditor;

export function Editor({
  initialContent,
  onChange,
  onReady,
}: {
  initialContent: object | null;
  onChange: (json: object) => void;
  onReady?: (editor: TiptapEditor) => void;
}) {
  const editor = useEditor({
    // Next renders on the server first; Tiptap must wait for the client.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Begin writing…" }),
    ],
    content: initialContent ?? "",
    editorProps: {
      attributes: { class: "prose", spellcheck: "true", "aria-label": "Page content" },
    },
    onCreate: ({ editor }) => onReady?.(editor),
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  return <EditorContent editor={editor} className="editor" />;
}

/** Formatting controls; rendered by the notebook view in a rail beside the page. */
export function Toolbar({ editor }: { editor: TiptapEditor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();
  const btn = (label: string, title: string, active: boolean, run: () => void, extra = "") => (
    <button
      type="button"
      className={`tool ${extra}`}
      aria-pressed={active}
      title={title}
      // Keep the selection in the editor while clicking the toolbar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  );

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting" aria-orientation="vertical">
      <div className="tool-group">
        {btn("H1", "Heading 1", s.h1, () => chain().toggleHeading({ level: 1 }).run())}
        {btn("H2", "Heading 2", s.h2, () => chain().toggleHeading({ level: 2 }).run())}
        {btn("H3", "Heading 3", s.h3, () => chain().toggleHeading({ level: 3 }).run())}
      </div>
      <div className="tool-group">
        {btn("B", "Bold (⌘B)", s.bold, () => chain().toggleBold().run(), "tool-b")}
        {btn("I", "Italic (⌘I)", s.italic, () => chain().toggleItalic().run(), "tool-i")}
        {btn("U", "Underline (⌘U)", s.underline, () => chain().toggleUnderline().run(), "tool-u")}
        {btn("S", "Strikethrough", s.strike, () => chain().toggleStrike().run(), "tool-s")}
      </div>
      <div className="tool-group">
        {btn("•", "Bulleted list", s.bullet, () => chain().toggleBulletList().run())}
        {btn("1.", "Numbered list", s.ordered, () => chain().toggleOrderedList().run())}
        {btn("☐", "Checklist", s.task, () => chain().toggleTaskList().run())}
        {btn("❝", "Quote", s.quote, () => chain().toggleBlockquote().run())}
        {btn("{ }", "Code block", s.code, () => chain().toggleCodeBlock().run())}
        {btn("—", "Divider", false, () => chain().setHorizontalRule().run())}
      </div>
      <div className="tool-group tool-group-end">
        <button type="button" className="tool" title="Undo (⌘Z)" disabled={!s.canUndo} onClick={() => chain().undo().run()}>
          ↺
        </button>
        <button type="button" className="tool" title="Redo (⇧⌘Z)" disabled={!s.canRedo} onClick={() => chain().redo().run()}>
          ↻
        </button>
      </div>
    </div>
  );
}
