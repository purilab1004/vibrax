'use client'

import { useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'

function Btn({ onClick, active, children }: {
  onClick: () => void; active?: boolean; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`px-2.5 py-1.5 text-xs border transition-colors ${
        active ? 'border-[#00ff41] text-[#00ff41]' : 'border-gray-800 text-gray-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, onUploadImage }: {
  value: string
  onChange: (html: string) => void
  onUploadImage: (file: File) => Promise<string | null>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'rte-content min-h-[320px] px-4 py-3 outline-none' },
    },
  })
  if (!editor) return null

  const pickImage = () => fileRef.current?.click()
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await onUploadImage(file)
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().setLink({ href: url }).run()
  }

  const c = () => editor.chain().focus()

  return (
    <div className="border border-gray-700 bg-[#0d0d0d]">
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-800">
        <Btn onClick={() => c().toggleBold().run()} active={editor.isActive('bold')}><b>B</b></Btn>
        <Btn onClick={() => c().toggleItalic().run()} active={editor.isActive('italic')}><i>I</i></Btn>
        <Btn onClick={() => c().toggleStrike().run()} active={editor.isActive('strike')}><s>S</s></Btn>
        <Btn onClick={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>H2</Btn>
        <Btn onClick={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>H3</Btn>
        <Btn onClick={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')}>••</Btn>
        <Btn onClick={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')}>1.</Btn>
        <Btn onClick={() => c().toggleBlockquote().run()} active={editor.isActive('blockquote')}>&quot;</Btn>
        <Btn onClick={() => c().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}>{'</>'}</Btn>
        <Btn onClick={setLink} active={editor.isActive('link')}>🔗</Btn>
        <Btn onClick={pickImage}>🖼</Btn>
        <Btn onClick={() => c().setHorizontalRule().run()}>—</Btn>
        <Btn onClick={() => c().undo().run()}>↩</Btn>
        <Btn onClick={() => c().redo().run()}>↪</Btn>
      </div>
      <EditorContent editor={editor} />
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleFile} className="hidden" />
    </div>
  )
}
