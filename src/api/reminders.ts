import { supabase } from '../lib/supabase';
import { chatWithAI } from './openrouter';

export interface Reminder {
  id?: string;
  user_id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  is_completed: boolean;
  created_at?: string;
}

export const extractReminders = async (transcript: string): Promise<Partial<Reminder>[]> => {
  const prompt = `You are a medical assistant. Extract a list of follow-up tasks, reminders, or clinical actions from the following patient consultation transcript. 
  
  Transcript: "${transcript}"
  
  Return ONLY a valid JSON array of objects. Each object must have:
  - "text": The task description
  - "priority": one of "high", "medium", or "low"
  - "due_date": ISO date string if mentioned, otherwise null.
  
  Example: [{"text": "Schedule MRI scan", "priority": "high", "due_date": null}]
  If no tasks found, return [].`;

  try {
    const response = await chatWithAI([{ role: 'user', content: prompt }]);
    const cleanResponse = response.replace(/```json|```/g, '').trim();
    const jsonMatch = cleanResponse.match(/\[.*\]/s);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Reminder extraction failed:", err);
    return [];
  }
};

export const saveReminders = async (userId: string, reminders: Partial<Reminder>[]) => {
  const dataToInsert = reminders.map(r => ({
    user_id: userId,
    text: r.text || "New Task",
    priority: r.priority || 'medium',
    due_date: r.due_date,
    is_completed: false
  }));

  const { data, error } = await supabase
    .from('reminders')
    .insert(dataToInsert)
    .select();

  if (error) throw error;
  return data;
};

export const fetchReminders = async (userId: string) => {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const toggleReminderStatus = async (id: string, isCompleted: boolean) => {
  const { error } = await supabase
    .from('reminders')
    .update({ is_completed: isCompleted })
    .eq('id', id);

  if (error) throw error;
};

export const formatRemindersForAI = (reminders: any[]) => {
  if (reminders.length === 0) return "You have no active reminders.";
  return reminders
    .filter(r => !r.is_completed)
    .map(r => `- [${r.priority.toUpperCase()}] ${r.text}${r.due_date ? ` (Due: ${r.due_date})` : ''}`)
    .join('\n');
};
