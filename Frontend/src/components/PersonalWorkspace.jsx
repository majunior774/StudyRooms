import { useEffect, useMemo, useState } from 'react';
import './PersonalWorkspace.css';

const apiBaseUrl = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

async function workspaceRequest(path, options = {}, onSessionExpired) {
  const response = await fetch(`${apiBaseUrl}/api/workspace${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) onSessionExpired?.();
  if (!response.ok) throw new Error(result.error || 'Could not save your workspace changes.');
  return result;
}

export default function PersonalWorkspace({ displayName, section = 'overview', hidden = false, onNavigate = () => {}, onSessionExpired }) {
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    workspaceRequest('', {}, onSessionExpired)
      .then((data) => {
        if (cancelled) return;
        setTasks(data.tasks ?? []);
        setNotes(data.notes ?? []);
        setError('');
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [onSessionExpired]);

  const pending = tasks.filter((task) => !task.done).length;
  const completed = tasks.length - pending;
  const visibleNotes = useMemo(() => notes.filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(query.toLowerCase())), [notes, query]);

  const addTask = async (event) => {
    event.preventDefault();
    if (saving || !taskDraft.trim()) return;
    setSaving(true);
    try {
      const { task } = await workspaceRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: taskDraft.trim() }),
      }, onSessionExpired);
      setTasks((current) => [task, ...current]);
      setTaskDraft('');
      setError('');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };
  const toggleTask = async (id) => {
    if (saving) return;
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const updatedTask = { ...task, done: !task.done };
    setTasks((current) => current.map((item) => item.id === id ? updatedTask : item));
    setSaving(true);
    try {
      const { task: savedTask } = await workspaceRequest(`/tasks/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ done: updatedTask.done }),
      }, onSessionExpired);
      setTasks((current) => current.map((item) => item.id === id ? savedTask : item));
      setError('');
    } catch (saveError) {
      setTasks((current) => current.map((item) => item.id === id ? task : item));
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };
  const removeTask = async (id) => {
    if (saving) return;
    setSaving(true);
    try {
      await workspaceRequest(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }, onSessionExpired);
      setTasks((current) => current.filter((task) => task.id !== id));
      setError('');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };
  const openNote = (note) => { setEditingNote(note?.id ?? null); setNoteTitle(note?.title ?? ''); setNoteBody(note?.body ?? ''); setNoteEditorOpen(true); };
  const saveNote = async (event) => {
    event.preventDefault();
    if (saving || !noteTitle.trim() || !noteBody.trim()) return;
    setSaving(true);
    try {
      const isEditing = editingNote !== null;
      const { note } = await workspaceRequest(
        isEditing ? `/notes/${encodeURIComponent(editingNote)}` : '/notes',
        {
          method: isEditing ? 'PUT' : 'POST',
          body: JSON.stringify({ title: noteTitle.trim(), body: noteBody.trim() }),
        },
        onSessionExpired
      );
      setNotes((current) => isEditing
        ? current.map((item) => item.id === editingNote ? note : item)
        : [note, ...current]);
      setEditingNote(null); setNoteTitle(''); setNoteBody(''); setError('');
      setNoteEditorOpen(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };
  const removeNote = async (id) => {
    if (saving) return;
    setSaving(true);
    try {
      await workspaceRequest(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' }, onSessionExpired);
      setNotes((current) => current.filter((note) => note.id !== id));
      setError('');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="sr-workspace" aria-label="Personal workspace" hidden={hidden}>
      <div className="sr-workspace__heading">
        <div>
          <p className="sr-workspace__eyebrow">YOUR SPACE</p>
          <h2 className="sr-font-heading">Personal Workspace</h2>
          <p className="sr-workspace__sub">Your tasks and notes, all in one place.</p>
        </div>
        <span className="sr-workspace__private">♙ Personal · {displayName || 'This browser'}</span>
      </div>

      <div className="sr-workspace__content">
      {error && <p className="sr-workspace__error" role="alert">{error}</p>}
      {saving && <p className="sr-workspace__saving" role="status" aria-live="polite"><span className="sr-workspace__saving-dot" />Saving your changes…</p>}
      {loading ? <p className="sr-workspace__loading" role="status">Loading your workspace…</p> : <>
      {section === 'overview' && <div className="sr-workspace__overview">
        <article className="sr-workspace__card">
          <div className="sr-workspace__cardtop"><span className="sr-workspace__icon">☷</span><span className="sr-workspace__count">{pending} pending</span></div>
          <h3>My Tasks</h3><p>Keep track of what you want to get done.</p>
          <div className="sr-workspace__meter"><span style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }} /></div>
          <small>{completed} of {tasks.length} completed</small>
          <button type="button" className="sr-workspace__link" onClick={() => onNavigate('tasks')}>View tasks →</button>
          <ul className="sr-workspace__preview">{tasks.slice(0, 2).map((task) => <li key={task.id}><span className={task.done ? 'is-done' : ''}>{task.title}</span></li>)}</ul>
        </article>
        <article className="sr-workspace__card">
          <div className="sr-workspace__cardtop"><span className="sr-workspace__icon">▤</span><span className="sr-workspace__count">{notes.length} saved</span></div>
          <h3>My Notes</h3><p>Capture ideas, summaries and useful references.</p>
          <div className="sr-workspace__note-preview">{notes[0] ? <><strong>{notes[0].title}</strong><span>{notes[0].body}</span></> : <span>No notes yet. Create your first note.</span>}</div>
          <button type="button" className="sr-workspace__link" onClick={() => { setEditingNote(null); onNavigate('notes'); }}>Open notes →</button>
        </article>
      </div>}

      {section === 'tasks' && <div className="sr-workspace__detail">
        <div className="sr-workspace__detail-head"><div><h3>My Tasks</h3><p>{pending} tasks left to complete</p></div><span className="sr-workspace__count">{completed}/{tasks.length} done</span></div>
        <form className="sr-workspace__add" onSubmit={addTask}><input value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="Add a task to your list..." aria-label="New task"/><button type="submit" disabled={saving || !taskDraft.trim()}>＋ Add task</button></form>
        <div className="sr-workspace__tasklist">{tasks.map((task) => <div className="sr-workspace__task" key={task.id}><label><input type="checkbox" checked={task.done} disabled={saving} onChange={() => toggleTask(task.id)}/><span className={task.done ? 'is-done' : ''}>{task.title}</span></label><span className={`sr-workspace__priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span><button disabled={saving} aria-label={`Delete ${task.title}`} onClick={() => removeTask(task.id)}>×</button></div>)}{!tasks.length && <p className="sr-workspace__empty">No tasks yet. Add your first one above.</p>}</div>
      </div>}

      {section === 'notes' && <div className="sr-workspace__detail">
        <div className="sr-workspace__detail-head"><div><h3>My Notes</h3><p>Your personal study notes</p></div><button className="sr-workspace__new" disabled={saving} onClick={() => openNote(null)}>＋ New note</button></div>
        {noteEditorOpen ? <form className="sr-workspace__note-editor" onSubmit={saveNote}><input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title" aria-label="Note title"/><textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Start writing your note..." aria-label="Note content" rows="5"/><div><button type="button" className="sr-workspace__cancel" disabled={saving} onClick={() => { setEditingNote(null); setNoteTitle(''); setNoteBody(''); setNoteEditorOpen(false); }}>Cancel</button><button type="submit" disabled={saving || !noteTitle.trim() || !noteBody.trim()}>Save note</button></div></form> : <>
          <input className="sr-workspace__search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your notes..." aria-label="Search notes"/>
          <div className="sr-workspace__notes-grid">{visibleNotes.map((note) => <article className="sr-workspace__note" key={note.id}><button className="sr-workspace__note-open" disabled={saving} onClick={() => openNote(note)}><strong>{note.title}</strong><span>{note.body}</span><small>Edited {new Date(note.updatedAt).toLocaleDateString()}</small></button><button className="sr-workspace__delete-note" disabled={saving} onClick={() => removeNote(note.id)} aria-label={`Delete ${note.title}`}>×</button></article>)}{!visibleNotes.length && <p className="sr-workspace__empty">No matching notes found.</p>}</div>
        </>}
      </div>}
      </>}
      </div>
      <p className="sr-workspace__footnote">Your tasks and notes are saved to this account and are not shared with a study room.</p>
    </section>
  );
}
