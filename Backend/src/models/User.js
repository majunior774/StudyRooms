import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true, maxlength: 200 },
  done: { type: Boolean, default: false },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const noteSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true, maxlength: 160 },
  body: { type: String, required: true, maxlength: 10000 },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  displayName: { type: String, required: true, trim: true, maxlength: 80 },
  passwordHash: { type: String, required: true, select: false },
  tasks: { type: [taskSchema], default: [] },
  notes: { type: [noteSchema], default: [] },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
