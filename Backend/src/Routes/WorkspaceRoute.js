import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import { requireAuth } from './AuthRoute.js';

const router = Router();
const PRIORITIES = new Set(['Low', 'Medium', 'High']);

router.use(requireAuth);

async function getWorkspaceUser(userId, res) {
  const user = await User.findById(userId);
  if (!user) res.status(401).json({ error: 'Account no longer exists.' });
  return user;
}

router.get('/', async (req, res) => {
  const user = await getWorkspaceUser(req.userId, res);
  if (!user) return;
  return res.json({ tasks: user.tasks, notes: user.notes });
});

router.post('/tasks', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const priority = req.body?.priority ?? 'Medium';
  if (!title || title.length > 200 || !PRIORITIES.has(priority)) {
    return res.status(400).json({ error: 'Enter a task title up to 200 characters and a valid priority.' });
  }

  const user = await getWorkspaceUser(req.userId, res);
  if (!user) return;
  const task = { id: randomUUID(), title, done: false, priority, createdAt: new Date() };
  user.tasks.unshift(task);
  await user.save();
  return res.status(201).json({ task });
});

router.patch('/tasks/:taskId', async (req, res) => {
  const updates = {};
  if (Object.hasOwn(req.body ?? {}, 'done')) {
    if (typeof req.body.done !== 'boolean') return res.status(400).json({ error: 'Task completion must be true or false.' });
    updates.done = req.body.done;
  }
  if (Object.hasOwn(req.body ?? {}, 'title')) {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title || title.length > 200) return res.status(400).json({ error: 'Enter a task title up to 200 characters.' });
    updates.title = title;
  }
  if (Object.hasOwn(req.body ?? {}, 'priority')) {
    if (!PRIORITIES.has(req.body.priority)) return res.status(400).json({ error: 'Select a valid task priority.' });
    updates.priority = req.body.priority;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Provide a task update.' });

  const user = await getWorkspaceUser(req.userId, res);
  if (!user) return;
  const task = user.tasks.find((item) => item.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  Object.assign(task, updates);
  await user.save();
  return res.json({ task });
});

router.delete('/tasks/:taskId', async (req, res) => {
  const user = await getWorkspaceUser(req.userId, res);
  if (!user) return;
  const taskCount = user.tasks.length;
  user.tasks = user.tasks.filter((task) => task.id !== req.params.taskId);
  if (user.tasks.length === taskCount) return res.status(404).json({ error: 'Task not found.' });
  await user.save();
  return res.json({ ok: true });
});

router.post('/notes', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!title || title.length > 160 || !body || body.length > 10000) {
    return res.status(400).json({ error: 'A note needs a title (up to 160 characters) and content (up to 10,000 characters).' });
  }

  const user = await getWorkspaceUser(req.userId, res);
  if (!user) return;
  const note = { id: randomUUID(), title, body, updatedAt: new Date() };
  user.notes.unshift(note);
  await user.save();
  return res.status(201).json({ note });
});

router.put('/notes/:noteId', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!title || title.length > 160 || !body || body.length > 10000) {
    return res.status(400).json({ error: 'A note needs a title (up to 160 characters) and content (up to 10,000 characters).' });
  }

  const user = await getWorkspaceUser(req.userId, res);
  if (!user) return;
  const note = user.notes.find((item) => item.id === req.params.noteId);
  if (!note) return res.status(404).json({ error: 'Note not found.' });
  note.title = title;
  note.body = body;
  note.updatedAt = new Date();
  await user.save();
  return res.json({ note });
});

router.delete('/notes/:noteId', async (req, res) => {
  const user = await getWorkspaceUser(req.userId, res);
  if (!user) return;
  const noteCount = user.notes.length;
  user.notes = user.notes.filter((note) => note.id !== req.params.noteId);
  if (user.notes.length === noteCount) return res.status(404).json({ error: 'Note not found.' });
  await user.save();
  return res.json({ ok: true });
});

export default router;
