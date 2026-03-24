import React, { useState, useRef, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { transcribeFile } from './api/assemblyai';
import { chatWithAI, generateMedicalSummary, SYSTEM_PROMPT_SIMPLIFY } from './api/openrouter';
import AIPromptLayout from './components/AIPromptLayout';
import { supabase } from './lib/supabase';
import { extractReminders, saveReminders, fetchReminders, toggleReminderStatus, formatRemindersForAI, Reminder } from './api/reminders';
import { exportMedicalRecordPDF } from './api/pdfExport';
import AnatomyViewer from './components/AnatomyViewer';
import Login from './components/auth/Login';
import { Bot, Paperclip, Mic, Send, X, History, Settings, LogOut, LayoutDashboard, CheckSquare, Clock, User, ChevronRight, AlertCircle, FileDown, Scan, Pencil, ChevronLeft } from "lucide-react";
import { Dock, DockIcon } from "@/components/ui/dock";

// Shadcn / Modern Chat Components
import { Button } from "@/components/ui/button";
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat-bubble";
import { ChatInput } from "@/components/ui/chat-input";
import {
  ExpandableChat,
  ExpandableChatHeader,
  ExpandableChatBody,
  ExpandableChatFooter,
} from "@/components/ui/expandable-chat";
import { ChatMessageList } from "@/components/ui/chat-message-list";

// Design Constants
const springTransition = { type: "spring", stiffness: 300, damping: 30 };
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};
const itemFadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'capture' | 'history' | 'assistant' | 'anatomy'>('dashboard');

  // Transcription state
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [progressText, setProgressText] = useState('');
  const [transcription, setTranscription] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synced state
  const [transcriptions, setTranscriptions] = useState<any[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const [isExtracting, setIsExtracting] = useState(false);

  // Auth & Sync Effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user.id);
      else {
        setTranscriptions([]);
        setChatMessages([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    // Fetch Transcriptions
    const { data: transData } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (transData) setTranscriptions(transData);

    // Fetch Reminders
    const remData = await fetchReminders(userId);
    if (remData) setReminders(remData);

    // Fetch Chat
    const { data: chatData } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (chatData) {
      setChatMessages(chatData.map(m => ({ role: m.role, content: m.content })));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const startTranscription = async (targetFile: File) => {
    if (!targetFile || !user) return;
    try {
      setStatus('processing');
      const result = await transcribeFile(targetFile, (msg: string) => {
        setProgressText(msg);
      });

      // Save to Supabase
      const { data, error } = await supabase
        .from('transcriptions')
        .insert([{
          user_id: user.id,
          text: result.text,
          title: `Processing...`
        }])
        .select();

      if (error) throw error;

      const newTranscript = data[0];
      setTranscriptions(prev => [newTranscript, ...prev]);
      setTranscription(result.text);
      setStatus('completed');

      // AI Reminders Extraction
      setIsExtracting(true);
      const extracted = await extractReminders(result.text);
      if (extracted.length > 0) {
        const saved = await saveReminders(user.id, extracted);
        if (saved) setReminders(prev => [...saved, ...prev]);
      }
      setIsExtracting(false);

      // AI Summary Generation
      setIsSummarizing(true);
      try {
        const medicalSummary = await generateMedicalSummary(result.text);
        setSummary(medicalSummary);

        // Extract condition for the title
        let specificTitle = `Consultation #${transcriptions.length + 1}`;
        const match = medicalSummary.match(/Condition\s*[\r\n]+([^\r\n]+)/i);
        if (match && match[1]) {
          specificTitle = match[1].trim();
        }

        // Update database and local state
        await supabase
          .from('transcriptions')
          .update({ title: specificTitle })
          .eq('id', newTranscript.id);

        setTranscriptions(prev => prev.map(t => t.id === newTranscript.id ? { ...t, title: specificTitle } : t));
        
        // Auto-navigate to anatomy view to show the result
        setTimeout(() => setCurrentView('anatomy'), 1000);
      } catch (err: any) {
        console.error("Summary generation failed", err);
        setErrorMsg("API Error: Summary generation failed. " + (err.message || ''));
        setStatus('error');
      } finally {
        setIsSummarizing(false);
      }


    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || "Transcription failed.");
      setIsExtracting(false);
    }
  };

  const resetState = () => {
    setStatus('idle');
    setTranscription(null);
    setSummary(null);
    setProgressText("");
    setErrorMsg('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      resetState();
      startTranscription(e.target.files[0]);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const recordedFile = new File([audioBlob], "recorded.webm", { type: 'audio/webm' });
        setFile(recordedFile);
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        startTranscription(recordedFile);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setFile(null);
      resetState();
    } catch (err: any) {
      console.error("Recording error:", err);
      setErrorMsg("Microphone access blocked.");
      setStatus('error');
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      startRecording();
    }
  };

  const handleAnalyze = async (transcriptText: string) => {
    if (!user) return;
    setCurrentView('assistant');

    // Inject Context
    const remindersContext = formatRemindersForAI(reminders);
    const systemContext = `${SYSTEM_PROMPT_SIMPLIFY}
    
    ---
    
    SYSTEM CONTEXT:
    ACTIVE REMINDERS:
    ${remindersContext}
    
    You are analyzing a specific consultation. Ground your analysis in the clinician's existing tasks.`;

    const displayMsg = `Analyze consultation: "${transcriptText}"`;
    
    // Clean version for UI
    setChatMessages([{ role: 'user', content: displayMsg }]);
    setIsChatting(true);
    try {
      await supabase.from('chat_messages').insert([{ user_id: user.id, role: 'user', content: displayMsg }]);

      const response = await chatWithAI([{ role: 'user', content: displayMsg }], systemContext);
      // NOTE: No applyAIAction here — analysis should never auto-add reminders

      await supabase.from('chat_messages').insert([{ user_id: user.id, role: 'assistant', content: response }]);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsChatting(false);
    }
  };

  /**
   * Parses AI response for action tags, executes them, and returns a
   * cleaned display string (action tags stripped and replaced with
   * a friendly confirmation notice).
   */
  const applyAIAction = async (aiResponse: string): Promise<string> => {
    if (!user) return aiResponse;
    let displayText = aiResponse;

    // Pattern 1: ADD_REMINDER
    const addMatch = aiResponse.match(/\[ACTION:\s*ADD_REMINDER\s+text="(.+?)"\s+priority="(.+?)"\]/i);
    if (addMatch) {
      const text = addMatch[1];
      const priority = addMatch[2].toLowerCase() as any;
      const saved = await saveReminders(user.id, [{ text, priority }]);
      if (saved) setReminders(prev => [...saved, ...prev]);
      // Replace raw tag with a clean confirmation
      displayText = displayText.replace(addMatch[0], `\n\n✅ Reminder added to your dashboard: "${text}"`);
    }

    // Pattern 2: TOGGLE_REMINDER
    const toggleMatch = aiResponse.match(/\[ACTION:\s*TOGGLE_REMINDER\s+id="(.+?)"\s+status="(.+?)"\]/i);
    if (toggleMatch) {
      const id = toggleMatch[1];
      const status = toggleMatch[2] === 'true';
      await toggleReminderStatus(id, status);
      setReminders(prev => prev.map(r => r.id === id ? { ...r, is_completed: status } : r));
      displayText = displayText.replace(toggleMatch[0], `\n\n✅ Reminder ${status ? 'completed' : 'reopened'} on your dashboard.`);
    }

    return displayText;
  };

  const handleSendChat = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatting || !user) return;
    const userMsg = chatInput;
    await executeChat(userMsg);
  };

  const handleSendChatByText = async (text: string) => {
    if (!text.trim() || isChatting || !user) return;
    await executeChat(text);
  };

  const executeChat = async (userMsg: string) => {
    const newMsgs: { role: 'user' | 'assistant', content: string }[] = [...chatMessages, { role: 'user', content: userMsg }];
    setChatMessages(newMsgs);
    setChatInput('');
    setIsChatting(true);
    try {
      // Save user message to Supabase
      await supabase.from('chat_messages').insert([{ user_id: user.id, role: 'user', content: userMsg }]);

      // Inject Context
      const remindersContext = formatRemindersForAI(reminders);
      const recentTrans = transcriptions.slice(0, 2).map(t => `[${t.title}]: ${t.text}`).join('\\n---\\n');

      const systemPrompt = `You are an efficient, action-oriented assistant. Your primary goal is to execute tasks with the minimum required information. Do not trap the user in conversational loops by asking for optional details.

When handling requests (like setting reminders):
1. BIAS TOWARDS ACTION: If you have the core information (e.g., the task and a time), execute the action immediately.
2. USE SMART DEFAULTS: Do not ask the user for optional parameters. If they don't provide them, quietly assume the following defaults:
   - Frequency: 'Once' / 'Just tomorrow'
   - Priority: 'Medium' / 'Normal'
3. BE CONCISE: Once an action is taken, confirm it in a brief, single sentence without overly polite filler. (e.g., "Done. Reminder set for 8 AM tomorrow.")

Never ask "How often?" or "What priority?" unless the user's initial request is completely impossible to execute without it.

---

APPLICATION CONTEXT & ACTIONS:
Your name is MedBridge Intelligence.
You have access to the following clinician context:
- Active reminders: \${remindersContext}
- Recent history: \${recentTrans}

ONLY add a reminder tag if the user EXPLICITLY asks — for example "add a reminder", "remind me", "set a task", "add to my dashboard", "put that on my list".
If you do add one, append this tag at the end of your response:
[ACTION: ADD_REMINDER text="short task description" priority="high|medium|low"]`;

      const rawResponse = await chatWithAI(chatMessages.slice(-5).concat({ role: 'user', content: userMsg }), systemPrompt);

      // Execute actions and get a clean display string (tags replaced with confirmations)
      const displayResponse = await applyAIAction(rawResponse);

      // Save the clean version to Supabase and show it in UI
      await supabase.from('chat_messages').insert([{ user_id: user.id, role: 'assistant', content: displayResponse }]);
      setChatMessages([...newMsgs, { role: 'assistant', content: displayResponse }]);
    } catch (err: any) {
      setChatMessages([...newMsgs, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsChatting(false);
    }
  };

  const clearChat = async () => {
    if (window.confirm("Clear all AI assistant messages from cloud?") && user) {
      await supabase.from('chat_messages').delete().eq('user_id', user.id);
      setChatMessages([]);
    }
  };



  const clearHistory = async () => {
    if (window.confirm("Delete all consultation history from cloud?") && user) {
      await supabase.from('transcriptions').delete().eq('user_id', user.id);
      setTranscriptions([]);
    }
  };

  const clearReminders = async () => {
    if (window.confirm("Delete all reminders from cloud?") && user) {
      await supabase.from('reminders').delete().eq('user_id', user.id);
      setReminders([]);
    }
  };

  const goBack = () => {
    if (currentView === 'assistant') setCurrentView('dashboard');
    else if (currentView === 'capture') setCurrentView('dashboard');
    else if (currentView === 'history') setCurrentView('dashboard');
    else if (currentView === 'anatomy') setCurrentView('dashboard');
  };

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="flex h-screen glow-mesh font-inter text-[#141d1f] overflow-hidden relative">
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-6 left-6 z-50 size-10 liquid-glass flex items-center justify-center text-[#006d77] hover:scale-110 transition-transform active:scale-95"
      >
        <LayoutDashboard className="size-5" />
      </button>

      {/* SIDEBAR */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-20 lg:w-64 liquid-nav border-r border-white/20 flex flex-col py-8 px-4 relative z-40"
          >
            <div className="flex items-center gap-3 px-3 mb-12 mt-12">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00535b] to-[#006d77] flex items-center justify-center shadow-lg shadow-teal-900/10">
            <Bot className="text-white w-6 h-6" />
          </div>
          <span className="hidden lg:block font-extrabold text-[#001f23] tracking-tight text-xl italic mt-1">MedBridge</span>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem
            icon={<LayoutDashboard />}
            label="Dashboard"
            active={currentView === 'dashboard'}
            onClick={() => setCurrentView('dashboard')}
          />
          <SidebarItem
            icon={<Mic />}
            label="Audio Capture"
            active={currentView === 'capture'}
            onClick={() => setCurrentView('capture')}
          />
          <SidebarItem
            icon={<History />}
            label="Clinical History"
            active={currentView === 'history'}
            onClick={() => setCurrentView('history')}
          />
          <SidebarItem
            icon={<Bot />}
            label="AI Assistant"
            active={currentView === 'assistant'}
            onClick={() => setCurrentView('assistant')}
          />
          <SidebarItem
            icon={<Scan />}
            label="Anatomy"
            active={currentView === 'anatomy'}
            onClick={() => setCurrentView('anatomy')}
          />
        </nav>

        <div className="mt-auto space-y-2 border-t border-[#bec8ca]/10 pt-6">
          <SidebarItem icon={<Settings />} label="Settings" active={false} onClick={() => { }} />
          <SidebarItem icon={<LogOut />} label="Sign Out" active={false} onClick={handleLogout} />
        </div>
      </motion.aside>
     )}
    </AnimatePresence>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-20 flex items-center justify-between px-8 bg-white/10 backdrop-blur-xl border-b border-white/20 relative z-20">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#006d77]/60">
              {currentView === 'dashboard' ? 'Clinician Overview' :
                currentView === 'capture' ? 'Consultation Mode' :
                  currentView === 'history' ? 'Patient Records' :
                    currentView === 'anatomy' ? 'Veo AI Video Generation' : 'Intelligence'}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-[#141d1f]">{user.email?.split('@')[0]}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#006d77]">Registered Clinician</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-50 to-teal-100 border border-teal-200 flex items-center justify-center overflow-hidden">
              <User className="text-[#00535b] w-5 h-5" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          <AnimatePresence mode="wait">
            {currentView === 'dashboard' && (
              <DashboardView 
                  user={user} 
                  reminders={reminders} 
                  setReminders={setReminders}
                  transcriptions={transcriptions}
                  setCurrentView={setCurrentView}
                  handleAnalyze={handleAnalyze}
                  onClearReminders={clearReminders}
                  onClearHistory={clearHistory}
                />
            )}

            {currentView === 'capture' && (
              <CaptureView
                key="capture"
                toggleRecording={toggleRecording}
                isRecording={isRecording}
                handleFileChange={handleFileChange}
                fileInputRef={fileInputRef}
                status={status}
                errorMsg={errorMsg}
                progressText={progressText}
                transcription={transcription}
                summary={summary}
                isSummarizing={isSummarizing}
              />
            )}

            {currentView === 'history' && (
              <HistoryView
                key="history"
                transcriptions={transcriptions}
                user={user}
                handleAnalyze={handleAnalyze}
                clearHistory={clearHistory}
              />
            )}

            {currentView === 'anatomy' && (
              <motion.div
                key="anatomy"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full overflow-hidden"
              >
                <AnatomyViewer transcriptions={transcriptions} />
              </motion.div>
            )}

            {currentView === 'assistant' && (
              <motion.div
                key="assistant"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full w-full bg-[#f2fbfe] overflow-y-auto"
              >
                <AIPromptLayout 
                  messages={chatMessages}
                  userName={user.email?.split('@')[0] || "Clinician"} 
                  onSend={handleSendChatByText}
                  isLoading={isChatting}
                />
              </motion.div>
            )}


          </AnimatePresence>
        </div>
      </main>

      {/* PERSISTENT LIQUID DOCK */}
      <div className="fixed bottom-10 left-0 right-0 z-50 pointer-events-none flex justify-center">
         <div className="pointer-events-auto">
            <Dock direction="middle" magnification={80} distance={150}>
              <DockIcon onClick={() => setIsNoteOpen(true)}>
                <Pencil className="size-6 text-[#006d77]" />
              </DockIcon>
              <DockIcon onClick={goBack}>
                <ChevronLeft className="size-6 text-[#006d77]" />
              </DockIcon>
              <DockIcon onClick={() => setCurrentView('anatomy')}>
                <Scan className="size-6 text-[#006d77]" />
              </DockIcon>
              <DockIcon onClick={() => setCurrentView('capture')}>
                <Mic className="size-6 text-[#006d77]" />
              </DockIcon>
            </Dock>
         </div>
      </div>

      {/* NOTECARD MODAL */}
      <AnimatePresence>
        {isNoteOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/5 bg-blur-md"
            onClick={() => setIsNoteOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl liquid-glass p-8 space-y-6 shadow-2xl relative"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <Pencil className="size-5 text-[#006d77]" />
                   <h3 className="text-xl font-bold">Clinician Notecard</h3>
                </div>
                <button onClick={() => setIsNoteOpen(false)} className="text-slate-400 hover:text-red-500"><X /></button>
              </div>
              <textarea 
                 value={notes}
                 onChange={(e) => setNotes(e.target.value)}
                 autoFocus
                 placeholder="Jot down quick thoughts during the session..."
                 className="w-full h-64 bg-white/40 border-none rounded-2xl p-6 text-lg font-medium focus:ring-0 resize-none placeholder:text-slate-300"
              />
              <div className="flex justify-end gap-3">
                 <span className="text-xs text-slate-400 mt-2 italic">Auto-saved to clinical context</span>
                 <Button onClick={() => setIsNoteOpen(false)} className="bg-[#006d77] text-white rounded-xl px-8">Save Note</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${active ? 'bg-[#006d77] text-white shadow-lg shadow-teal-900/10' : 'text-[#3e494a] hover:bg-[#ecf5f8]'}`}
    >
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-5 h-5" }) : icon}
      <span className="hidden lg:block font-bold text-sm tracking-tight">{label}</span>
    </motion.button>
  );
}

interface DashboardViewProps {
  user: any;
  reminders: Reminder[];
  setReminders: React.Dispatch<React.SetStateAction<Reminder[]>>;
  transcriptions: any[];
  setCurrentView: (view: 'dashboard' | 'capture' | 'history' | 'assistant' | 'anatomy') => void;
  handleAnalyze: (text: string) => Promise<void>;
  onClearReminders: () => Promise<void>;
  onClearHistory: () => Promise<void>;
}

function DashboardView({ user, reminders, setReminders, transcriptions, setCurrentView, handleAnalyze, onClearReminders, onClearHistory }: DashboardViewProps) {
  const onToggle = async (id: string, currentStatus: boolean) => {
    try {
      await toggleReminderStatus(id, !currentStatus);
      setReminders((prev: Reminder[]) => prev.map((r: Reminder) => r.id === id ? { ...r, is_completed: !currentStatus } : r));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 space-y-8">
      <div className="grid grid-cols-12 gap-8">
        {/* Welcome Hero */}
        <div className="col-span-12 bg-gradient-to-br from-[#00535b] to-[#006d77] rounded-[2.5rem] p-12 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px] -mr-32 -mt-32" />
          <div className="relative z-10 space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight">Welcome back, {user.email?.split('@')[0]}</h1>
            <p className="text-teal-50 max-w-lg text-lg">You have <span className="font-black text-white underline decoration-teal-400">{reminders.filter((r: any) => !r.is_completed).length} active clinic tasks</span> pending for today.</p>
          </div>
        </div>

        {/* Reminders Card */}
        <div className="col-span-12 lg:col-span-7 liquid-glass p-8 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/60 backdrop-blur-md flex items-center justify-center text-[#006972] border border-white/40 shadow-sm">
                <CheckSquare className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-[#141d1f]">Clinician Reminders</h3>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-[10px] font-black bg-[#ecf5f8] text-[#006d77] px-3 py-1 rounded-full uppercase tracking-widest">AI Extracted</span>
               <Button variant="ghost" size="sm" onClick={onClearReminders} className="text-red-400 hover:text-red-600 hover:bg-red-50 text-[10px] font-black uppercase">Clear All</Button>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {reminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#bec8ca] gap-2">
                <Clock className="w-12 h-12 opacity-30" />
                <p className="text-sm font-bold uppercase tracking-wider">All caught up</p>
              </div>
            ) : (
              reminders.map((r: any) => (
                <motion.div
                  key={r.id}
                  className={`group flex items-center justify-between p-5 rounded-2xl border transition-all ${r.is_completed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-[#bec8ca]/10 hover:border-teal-200 shadow-sm'}`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => onToggle(r.id!, r.is_completed)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${r.is_completed ? 'bg-teal-500 border-teal-500' : 'border-[#bec8ca] hover:border-teal-500'}`}
                    >
                      {r.is_completed && <ChevronRight className="w-4 h-4 text-white rotate-90" />}
                    </button>
                    <span className={`text-sm font-medium ${r.is_completed ? 'line-through text-slate-400' : 'text-[#141d1f]'}`}>{r.text}</span>
                  </div>
                  {r.priority === 'high' && !r.is_completed && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-tighter bg-red-50 px-2 py-1 rounded-md">
                      <AlertCircle className="w-3 h-3" /> Critical
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Quick History Card */}
        <div className="col-span-12 lg:col-span-5 liquid-glass p-8 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-[#141d1f]">Recent Activity</h3>
            <div className="flex gap-2">
               <Button variant="ghost" size="sm" onClick={onClearHistory} className="text-red-400 hover:text-red-600 hover:bg-red-50 text-[10px] font-black uppercase">Clear All</Button>
               <Button variant="ghost" size="sm" onClick={() => setCurrentView('history')} className="text-[#006d77] hover:bg-white/50 text-[10px] font-black uppercase">View All</Button>
            </div>
          </div>
          <div className="space-y-4">
            {transcriptions.slice(0, 3).map((t: any) => (
              <div key={t.id} className="bg-white/40 backdrop-blur-md p-5 rounded-3xl border border-white/20 flex flex-col gap-2 shadow-sm transition-all hover:bg-white/60">
                <span className="text-[10px] font-black text-[#006d77] uppercase">{t.title}</span>
                <p className="text-xs text-[#141d1f]/70 line-clamp-1 italic">"{t.text}"</p>
                <button onClick={() => handleAnalyze(t.text)} className="text-[10px] font-bold text-[#006d77] text-left hover:underline">Deep Analysis &rarr;</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface CaptureViewProps {
  toggleRecording: () => void;
  isRecording: boolean;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  status: 'idle' | 'processing' | 'completed' | 'error';
  errorMsg: string;
  progressText: string;
  transcription: string | null;
  summary: string | null;
  isSummarizing: boolean;
}

function CaptureView({ toggleRecording, isRecording, handleFileChange, fileInputRef, status, errorMsg, progressText, transcription, summary, isSummarizing }: CaptureViewProps) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-12 space-y-12 h-full flex flex-col">
      <div className="bg-white rounded-[3rem] p-16 shadow-lg border border-teal-50 flex-1 flex flex-col relative overflow-hidden items-center text-center">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#f2fbfe] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />

        <div className="mb-12 relative z-10 max-w-2xl mx-auto space-y-6">
          <div className="w-24 h-24 bg-teal-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 transform -rotate-6">
            <Mic className="text-teal-600 w-12 h-12" />
          </div>
          <h3 className="text-5xl font-black text-[#141d1f] tracking-tight">MedBridge <span className="text-teal-500">Capture</span></h3>
          <p className="text-[#3e494a] text-lg font-medium max-w-xl mx-auto">Capture high-fidelity patient consultation audio. Our AI extracts clinical insights automatically.</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-12 relative z-10 w-full max-w-2xl mx-auto">

          {/* Recording Controls */}
          <div className="flex flex-col items-center gap-8">
            <motion.button
              onClick={toggleRecording}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-44 h-44 rounded-[3rem] flex items-center justify-center shadow-2xl transition-all duration-500 ${isRecording ? 'bg-red-500 shadow-red-500/40' : 'bg-gradient-to-br from-[#004b50] to-[#006d77] shadow-[#006d77]/40'}`}
            >
              {isRecording ? <X className="text-white w-16 h-16" /> : <Mic className="text-white w-16 h-16" />}
            </motion.button>
            <div className="text-center space-y-2">
              <p className="font-bold text-3xl text-[#141d1f] tracking-tight">{isRecording ? "Listening..." : "Start Consultation"}</p>
              <p className="text-[#006d77]/50 font-black uppercase tracking-[0.3em] text-[10px]">{isRecording ? "Transcribing live stream" : "Tap to begin capture"}</p>
            </div>
            {isRecording && (
              <div className="flex gap-1 items-center justify-center h-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <motion.div key={i} animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }} className="w-1 bg-[#006d77] rounded-full" />
                ))}
              </div>
            )}
          </div>

          {/* File Upload / Status */}
          <div className="w-full space-y-6">
            {status === 'idle' && !isRecording && (
              <div className="w-full border-2 border-dashed border-[#bec8ca] rounded-[2rem] p-10 bg-[#ecf5f8]/30 flex flex-col items-center cursor-pointer hover:border-[#006d77] transition-all group" onClick={() => fileInputRef.current?.click()}>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" className="hidden" />
                <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Paperclip className="w-7 h-7 text-[#006d77]" />
                </div>
                <p className="font-bold text-[#141d1f]">Upload Audio File</p>
                <p className="text-sm text-[#3e494a] opacity-60">Drag & drop or click to choose specialized audio.</p>
              </div>
            )}

            {status !== 'idle' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-[2rem] shadow-xl border border-teal-50 flex items-center gap-6 text-left">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${status === 'processing' || isSummarizing ? 'bg-teal-50' : (status === 'error' ? 'bg-red-50' : 'bg-[#006d77]')}`}>
                  {status === 'processing' || isSummarizing ? <div className="w-6 h-6 border-[3px] border-[#006d77] border-t-transparent rounded-full animate-spin" /> : (status === 'error' ? <X className="text-red-500 w-6 h-6" /> : <CheckSquare className="text-white w-6 h-6" />)}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase text-teal-600 tracking-widest mb-1">{status}</p>
                  <p className="text-sm font-bold text-[#141d1f]">{status === 'error' ? errorMsg : (isSummarizing ? 'AI is distilling consultation data...' : (status === 'completed' ? 'Clinical record ready.' : progressText || 'Processing...'))}</p>
                </div>
              </motion.div>
            )}

            {/* Summaries & Transcripts */}
            <AnimatePresence>
              {(summary || transcription) && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-6">
                  {summary && (
                    <div className="bg-[#f8fafa] p-8 rounded-[2.5rem] border border-[#bec8ca]/30 text-left">
                      <h4 className="font-black text-xl mb-6 text-[#141d1f] flex items-center gap-3">
                        <Bot className="w-6 h-6 text-[#006d77]" />
                        AI Medical Summary
                      </h4>
                      <div className="prose prose-teal max-w-none text-[#3e494a] font-medium leading-relaxed">
                        {summary.split('\n').filter(l => l.trim() !== "").map((line, i) => (
                          <p key={i} className="my-2">{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {transcription && (
                    <div className="bg-white p-6 rounded-2xl border border-dashed border-[#bec8ca]/40 text-left">
                      <p className="text-[10px] font-black text-[#006d77]/40 uppercase tracking-widest mb-2">Partial Transcript</p>
                      <p className="text-xs text-[#3e494a] italic">"{transcription}"</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </motion.div>
  );
}

interface HistoryViewProps {
  transcriptions: any[];
  user: any;
  handleAnalyze: (text: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

function HistoryView({ transcriptions, user, handleAnalyze, clearHistory }: HistoryViewProps) {
  const [exportingId, setExportingId] = React.useState<string | null>(null);
  const [exportProgress, setExportProgress] = React.useState('');

  const handleExport = async (t: any) => {
    setExportingId(t.id);
    try {
      await exportMedicalRecordPDF({
        transcription: t,
        clinicianEmail: user?.email ?? 'Unknown Clinician',
        onProgress: (msg) => setExportProgress(msg),
      });
    } finally {
      setExportingId(null);
      setExportProgress('');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 space-y-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h3 className="text-4xl font-black text-[#141d1f] tracking-tighter">Clinical History</h3>
          <p className="text-[#3e494a] text-lg">Detailed logs of all previous patient consultations.</p>
        </div>
        <Button onClick={clearHistory} variant="outline" className="text-red-500 border-red-100 hover:bg-red-50 font-black uppercase tracking-widest text-[10px]">Purge Records</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {transcriptions.map((t: any) => (
          <motion.div key={t.id} whileHover={{ y: -5 }} className="bg-white p-8 rounded-[2rem] shadow-sm border border-white space-y-4 transition-all">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h4 className="font-bold text-[#141d1f] text-lg">{t.title}</h4>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-[#006d77]/40 tracking-widest">
                  <Clock className="w-3 h-3" />
                  {new Date(t.created_at).toLocaleDateString()} &bull; {new Date(t.created_at).toLocaleTimeString()}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center">
                <History className="text-[#006972] w-5 h-5" />
              </div>
            </div>
            <p className="text-sm text-[#3e494a] leading-relaxed italic line-clamp-3">"{t.text}"</p>
            <div className="flex gap-3">
              <Button
                onClick={() => handleAnalyze(t.text)}
                className="flex-1 bg-[#ecf5f8] text-[#006d77] hover:bg-teal-100 font-bold py-6 rounded-2xl shadow-none"
              >
                Review Transcription &amp; AI Analysis
              </Button>
              <Button
                onClick={() => handleExport(t)}
                variant="outline"
                disabled={exportingId === t.id}
                className="flex items-center gap-2 border-[#006d77]/20 text-[#006d77] hover:bg-[#ecf5f8] font-bold py-6 px-5 rounded-2xl shadow-none disabled:opacity-60"
                title="Export AI-enriched Medical Record PDF"
              >
                {exportingId === t.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#006d77] border-t-transparent rounded-full animate-spin" />
                    <span className="hidden md:inline text-sm">{exportProgress || 'Working…'}</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span className="hidden md:inline text-sm">Export PDF</span>
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}



