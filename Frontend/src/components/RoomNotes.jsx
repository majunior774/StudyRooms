import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, Extension, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness.js';
import './RoomNotes.css';

const REMOTE = 'room-notes-remote';
const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize || null,
          renderHTML: (attributes) => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
        },
      },
    }];
  },
});

function userColor(name) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return ['#397568', '#b45b45', '#596fa2', '#92713b', '#805d91', '#317e8b'][Math.abs(hash) % 6];
}

export default function RoomNotes({ socket, roomId, displayName = 'Guest', onClose }) {
  const doc = useMemo(() => new Y.Doc(), []);
  const awareness = useMemo(() => new Awareness(doc), [doc]);
  const [collaboratorCount, setCollaboratorCount] = useState(1);
  const [notesSynced, setNotesSynced] = useState(false);
  const [title, setTitle] = useState('Study room notes');
  const destroyTimer = useRef(null);
  const titleMap = useMemo(() => doc.getMap('roomNotesMeta'), [doc]);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      TextStyle,
      FontSize,
      FontFamily.configure({ types: ['textStyle'] }),
      Color,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Collaboration.configure({ document: doc }),
      CollaborationCaret.configure({
        provider: { awareness },
        user: { name: displayName, color: userColor(displayName), socketId: socket?.id },
      }),
    ],
    editorProps: { attributes: { class: 'room-notes__page', 'aria-label': 'Shared room notes' } },
  }, [doc, awareness, displayName, socket?.id]);

  useEffect(() => {
    const publishJoin = () => {
      if (!socket?.connected) return;
      setNotesSynced(false);
      socket.emit('room-notes:join', { roomId, update: Y.encodeStateAsUpdate(doc) });
      const localId = awareness.clientID;
      socket.emit('room-notes:awareness-update', {
        roomId,
        update: encodeAwarenessUpdate(awareness, [localId]),
      });
    };
    const handleSync = (payload = {}) => {
      if (payload.roomId !== roomId || !(payload.update instanceof Uint8Array)) return;
      Y.applyUpdate(doc, payload.update, REMOTE);
      setNotesSynced(true);
    };
    const handleUpdate = (payload = {}) => {
      if (payload.roomId === roomId && payload.update instanceof Uint8Array) Y.applyUpdate(doc, payload.update, REMOTE);
    };
    const handleAwareness = (payload = {}) => {
      if (payload.roomId === roomId && payload.update instanceof Uint8Array) applyAwarenessUpdate(awareness, payload.update, REMOTE);
    };
    const handleError = (payload = {}) => {
      if (payload.roomId === roomId) console.warn(payload.message || 'Shared notes could not sync.');
    };
    const sendDocUpdate = (update, origin) => {
      if (origin !== REMOTE && socket?.connected) socket.emit('room-notes:update', { roomId, update });
    };
    const sendAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin === REMOTE || !socket?.connected) return;
      const changed = [...added, ...updated, ...removed];
      if (changed.length) socket.emit('room-notes:awareness-update', {
        roomId,
        update: encodeAwarenessUpdate(awareness, changed),
      });
    };
    socket?.on('connect', publishJoin);
    socket?.on('room-notes:sync', handleSync);
    socket?.on('room-notes:update', handleUpdate);
    socket?.on('room-notes:awareness', handleAwareness);
    socket?.on('room-notes:error', handleError);
    doc.on('update', sendDocUpdate);
    awareness.on('update', sendAwarenessUpdate);
    awareness.setLocalStateField('user', { name: displayName, color: userColor(displayName), socketId: socket?.id });
    publishJoin();
    return () => {
      socket?.off('connect', publishJoin);
      socket?.off('room-notes:sync', handleSync);
      socket?.off('room-notes:update', handleUpdate);
      socket?.off('room-notes:awareness', handleAwareness);
      socket?.off('room-notes:error', handleError);
      doc.off('update', sendDocUpdate);
      awareness.off('update', sendAwarenessUpdate);
      awareness.setLocalState(null);
    };
  }, [socket, roomId, doc, awareness, displayName]);

  useEffect(() => {
    const updateTitle = () => setTitle(titleMap.get('title') || 'Study room notes');
    titleMap.observe(updateTitle);
    updateTitle();
    if (notesSynced && !titleMap.has('title')) titleMap.set('title', 'Study room notes');
    return () => titleMap.unobserve(updateTitle);
  }, [titleMap, notesSynced]);

  useEffect(() => {
    const updateCount = () => setCollaboratorCount(Math.max(1, awareness.getStates().size));
    awareness.on('change', updateCount);
    updateCount();
    return () => awareness.off('change', updateCount);
  }, [awareness]);

  useEffect(() => {
    clearTimeout(destroyTimer.current);
    return () => {
      destroyTimer.current = setTimeout(() => {
        awareness.destroy();
        doc.destroy();
      }, 0);
    };
  }, [awareness, doc]);

  const run = (command) => editor?.chain().focus()[command]().run();
  const active = (name, attrs) => editor?.isActive(name, attrs) ? ' is-active' : '';
  const setFontSize = (size) => editor?.chain().focus().setMark('textStyle', { fontSize: size }).run();
  const setFont = (family) => editor?.chain().focus().setFontFamily(family).run();

  return (
    <section className="room-notes" aria-label="Collaborative room notes">
      <header className="room-notes__header">
        <div className="room-notes__heading">
          <span className="room-notes__eyebrow">ROOM TOOL · LIVE</span>
          <input className="room-notes__title" aria-label="Notes title" value={title} onChange={(event) => titleMap.set('title', event.target.value)} />
          <span className="room-notes__presence"><i />{collaboratorCount} {collaboratorCount === 1 ? 'person' : 'people'} here</span>
        </div>
        <div className="room-notes__header-actions">
          <button type="button" className="room-notes__pdf" onClick={() => window.print()}>Save as PDF</button>
          <button type="button" className="room-notes__close" onClick={onClose} aria-label="Close room notes">×</button>
        </div>
      </header>
      <div className="room-notes__toolbar" role="toolbar" aria-label="Text formatting">
        <select aria-label="Font" defaultValue="Inter" onChange={(event) => setFont(event.target.value)}>
          <option value="Inter">Inter</option><option value="Georgia">Georgia</option><option value="Arial">Arial</option><option value="'Courier New'">Courier New</option><option value="Verdana">Verdana</option>
        </select>
        <select aria-label="Font size" defaultValue="16px" onChange={(event) => setFontSize(event.target.value)}>
          <option value="12px">12</option><option value="14px">14</option><option value="16px">16</option><option value="20px">20</option><option value="24px">24</option><option value="32px">32</option>
        </select>
        <span className="room-notes__divider" />
        <button type="button" className={`room-notes__tool${active('bold')}`} onClick={() => run('toggleBold')} aria-label="Bold"><strong>B</strong></button>
        <button type="button" className={`room-notes__tool${active('italic')}`} onClick={() => run('toggleItalic')} aria-label="Italic"><em>I</em></button>
        <button type="button" className={`room-notes__tool${active('underline')}`} onClick={() => run('toggleUnderline')} aria-label="Underline"><u>U</u></button>
        <button type="button" className={`room-notes__tool${active('strike')}`} onClick={() => run('toggleStrike')} aria-label="Strikethrough"><s>S</s></button>
        <label className="room-notes__color" title="Text color"><input type="color" aria-label="Text color" defaultValue="#283832" onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()} /></label>
        <span className="room-notes__divider" />
        <button type="button" className={`room-notes__tool${active('bulletList')}`} onClick={() => run('toggleBulletList')} aria-label="Bulleted list">• ≡</button>
        <button type="button" className={`room-notes__tool${active('orderedList')}`} onClick={() => run('toggleOrderedList')} aria-label="Numbered list">1. ≡</button>
        <button type="button" className="room-notes__tool" onClick={() => editor?.chain().focus().setTextAlign('left').run()} aria-label="Align left">☰</button>
        <button type="button" className="room-notes__tool" onClick={() => editor?.chain().focus().setTextAlign('center').run()} aria-label="Align center">≡</button>
        <button type="button" className="room-notes__tool" onClick={() => run('undo')} aria-label="Undo">↶</button>
        <button type="button" className="room-notes__tool" onClick={() => run('redo')} aria-label="Redo">↷</button>
      </div>
      <div className="room-notes__workspace"><h1 className="room-notes__print-title">{title}</h1><EditorContent editor={editor} /></div>
      <footer className="room-notes__footer">Live for this room session only. Save a PDF to keep a copy on your device.</footer>
    </section>
  );
}
