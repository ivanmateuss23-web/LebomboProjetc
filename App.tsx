
import React, { useState, useEffect } from 'react';
import { Card, Deck, UserStats, Rating, Difficulty, QuestionType, Folder, User } from './types';
import Dashboard from './components/Dashboard';
import StudySession from './components/StudySession';
// Auth component removed
import { generateDeckContent, generateStudyGuide } from './services/geminiService';
import { calculateSM2, isDue, getNextReviewDate } from './utils/sm2';
import { processFile } from './utils/fileHelpers';
import { Loader2, Plus, Upload, FileText, Type, Stethoscope, ArrowLeft, Book, CheckSquare, AlignLeft, Layers, Globe, FileSpreadsheet, Palette, X, Pencil, RefreshCw, LogOut, Bone, GraduationCap } from 'lucide-react';

// --- Default/Initial Data ---
const INITIAL_STATS: UserStats = {
  streak: 0,
  lastStudyDate: null,
  totalXp: 0,
  cardsMastered: 0
};

const DEFAULT_BG = '#f8fafc'; // Slate 50

const App: React.FC = () => {
  // --- Auth State ---
  // Default Guest User - No Login Required
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'user_guest',
    name: 'Estudante',
    email: 'guest@lebombo.app',
    avatar: 'https://ui-avatars.com/api/?name=Estudante&background=0ea5e9&color=fff'
  });

  // --- View State ---
  const [view, setView] = useState<'dashboard' | 'study' | 'creating' | 'guide'>('dashboard');
  
  // Data State
  const [decks, setDecks] = useState<Deck[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  
  // Navigation State
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null); // For folder navigation
  
  // Study Session State
  const [studySessionCards, setStudySessionCards] = useState<Card[]>([]);
  
  // Theme State
  const [appBg, setAppBg] = useState<string>(DEFAULT_BG);
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Creation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [creationMode, setCreationMode] = useState<'topic' | 'file' | 'clinical'>('topic');
  const [newTopic, setNewTopic] = useState('');
  const [newLevel, setNewLevel] = useState<'Graduação' | 'Pós-Graduação'>('Graduação');
  const [questionFormat, setQuestionFormat] = useState<'mixed' | 'multiple_choice' | 'open'>('mixed');
  const [language, setLanguage] = useState<'pt' | 'es'>('pt');
  const [customContent, setCustomContent] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFormat, setEditFormat] = useState<'mixed' | 'multiple_choice' | 'open'>('mixed');
  const [regenerateOnEdit, setRegenerateOnEdit] = useState(false);

  // --- Effects (Load/Save) ---

  // Load User Data
  useEffect(() => {
    if (currentUser) {
        const prefix = `ma_user_${currentUser.id}_`;
        
        const savedDecks = localStorage.getItem(`${prefix}decks`);
        const savedFolders = localStorage.getItem(`${prefix}folders`);
        const savedCards = localStorage.getItem(`${prefix}cards`);
        const savedStats = localStorage.getItem(`${prefix}stats`);
        const savedBg = localStorage.getItem(`${prefix}bg`);

        setDecks(savedDecks ? JSON.parse(savedDecks) : []);
        setFolders(savedFolders ? JSON.parse(savedFolders) : []);
        setCards(savedCards ? JSON.parse(savedCards) : []);
        setStats(savedStats ? JSON.parse(savedStats) : INITIAL_STATS);
        setAppBg(savedBg || DEFAULT_BG);
    }
  }, [currentUser]);

  // Save Data when state changes
  useEffect(() => {
    if (currentUser) {
        const prefix = `ma_user_${currentUser.id}_`;
        
        localStorage.setItem(`${prefix}decks`, JSON.stringify(decks));
        localStorage.setItem(`${prefix}folders`, JSON.stringify(folders));
        localStorage.setItem(`${prefix}cards`, JSON.stringify(cards));
        localStorage.setItem(`${prefix}stats`, JSON.stringify(stats));
        localStorage.setItem(`${prefix}bg`, appBg);
    }
  }, [decks, folders, cards, stats, appBg, currentUser]);

  // --- Handlers ---

  // Folder Actions
  const handleCreateFolder = (name: string) => {
    const newFolder: Folder = {
      id: Date.now().toString(),
      name,
      createdAt: Date.now()
    };
    setFolders(prev => [...prev, newFolder]);
  };

  const handleDeleteFolder = (folderId: string) => {
    // Move contained decks to root
    setDecks(prev => prev.map(d => d.folderId === folderId ? { ...d, folderId: null } : d));
    // Remove folder
    setFolders(prev => prev.filter(f => f.id !== folderId));
    if (currentFolderId === folderId) setCurrentFolderId(null);
  };

  const handleMoveDeck = (deckId: string, targetFolderId: string | null) => {
    setDecks(prev => prev.map(d => d.id === deckId ? { ...d, folderId: targetFolderId } : d));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReadingFile(true);
    setCustomContent('');

    try {
        const text = await processFile(file);
        setCustomContent(text);
        if (!newTopic) {
            setNewTopic(file.name.replace(/\.[^/.]+$/, ""));
        }
    } catch (error: any) {
        console.error("File processing error:", error);
        alert(error.message || "Erro ao ler arquivo.");
    } finally {
        setIsReadingFile(false);
    }
  };

  const handleCreateDeck = async () => {
    const title = creationMode === 'topic' ? newTopic : (creationMode === 'clinical' ? newTopic : (newTopic || 'Conteúdo Personalizado'));
    
    if (!title.trim()) return;
    if (creationMode === 'file' && !customContent.trim()) {
        alert("Por favor, cole um texto ou faça upload de um arquivo.");
        return;
    }

    setIsGenerating(true);
    try {
      const contentToUse = creationMode === 'file' ? customContent : undefined;
      
      const [generatedCardsData, studyGuideHtml] = await Promise.all([
          generateDeckContent(title, newLevel, 40, contentToUse, creationMode, questionFormat, language, customInstructions),
          generateStudyGuide(title, newLevel, contentToUse, creationMode, language)
      ]);
      
      const newDeckId = Date.now().toString();
      
      let description = '';
      if (creationMode === 'topic') description = `${language === 'es' ? 'Curso Completo de' : 'Curso Completo de'} ${newLevel} - ${title}`;
      else if (creationMode === 'clinical') description = `${language === 'es' ? 'Casos Clínicos:' : 'Casos Clínicos:'} ${title}`;
      else description = `Análise customizada (${new Date().toLocaleDateString()})`;

      const newDeck: Deck = {
        id: newDeckId,
        folderId: currentFolderId,
        title: title,
        description: description,
        totalCards: generatedCardsData.length,
        masteryLevel: 0,
        createdAt: Date.now(),
        studyGuide: studyGuideHtml
      };

      const newCards = generatedCardsData.map(c => ({
        ...c,
        deckId: newDeckId
      })) as Card[];

      setDecks(prev => [...prev, newDeck]);
      setCards(prev => [...prev, ...newCards]);
      
      setIsGenerating(false);
      setNewTopic('');
      setCustomContent('');
      setCustomInstructions('');
      setView('dashboard');

    } catch (error) {
      console.error(error);
      alert("Erro ao gerar conteúdo. A API pode estar sobrecarregada ou o texto é muito longo. Tente novamente.");
      setIsGenerating(false);
    }
  };

  const startSession = (deckId: string) => {
    const deckCards = cards.filter(c => c.deckId === deckId);
    
    // For MVP: Prioritize due cards, but if few/none, mix in others
    let sessionCards = deckCards.filter(c => isDue(c.nextReviewDate));
    
    if (sessionCards.length < 10) {
      const remaining = deckCards.filter(c => !sessionCards.includes(c));
      const filler = remaining.sort(() => 0.5 - Math.random()).slice(0, 20 - sessionCards.length);
      sessionCards = [...sessionCards, ...filler];
    }
    
    if (sessionCards.length === 0) {
       if (deckCards.length > 0) {
         // Fallback if SRS dates are mostly future: just study random 20
         sessionCards = deckCards.sort(() => 0.5 - Math.random()).slice(0, 20);
       } else {
         alert("Deck vazio.");
         return;
       }
    }

    setActiveDeckId(deckId);
    setStudySessionCards(sessionCards);
    setView('study');
  };
  
  const openGuide = (deckId: string) => {
    setActiveDeckId(deckId);
    setView('guide');
  };

  const handleDeleteDeck = (deckId: string) => {
    setDecks(prev => prev.filter(d => d.id !== deckId));
    setCards(prev => prev.filter(c => c.deckId !== deckId));
  };

  // Edit Handlers
  const onEditDeck = (deckId: string) => {
    const deck = decks.find(d => d.id === deckId);
    if (deck) {
        setEditingDeck(deck);
        setEditTitle(deck.title);
        // Try to guess current format from first card, or default to mixed
        const deckCards = cards.filter(c => c.deckId === deckId);
        const hasMC = deckCards.some(c => c.type === QuestionType.MULTIPLE_CHOICE);
        const hasOpen = deckCards.some(c => c.type === QuestionType.CONCEPT_CARD);
        
        if (hasMC && !hasOpen) setEditFormat('multiple_choice');
        else if (!hasMC && hasOpen) setEditFormat('open');
        else setEditFormat('mixed');

        setRegenerateOnEdit(false);
        setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingDeck) return;
    
    setIsGenerating(true);

    try {
        if (regenerateOnEdit) {
            const newCardsData = await generateDeckContent(
                editTitle, 
                'Graduação', // Defaulting since we didn't store level in Deck
                40, 
                undefined, 
                'topic', 
                editFormat, 
                language
            );

            // Remove old cards
            setCards(prev => prev.filter(c => c.deckId !== editingDeck.id));
            
            // Add new cards
            const newCards = newCardsData.map(c => ({
                ...c,
                deckId: editingDeck.id
            })) as Card[];
            
            setCards(prev => [...prev, ...newCards]);

             // Update Deck Stats
            setDecks(prev => prev.map(d => d.id === editingDeck.id ? {
                ...d, 
                title: editTitle,
                totalCards: newCards.length,
                masteryLevel: 0 // Reset mastery on regen
            } : d));

        } else {
            // Just update title
             setDecks(prev => prev.map(d => d.id === editingDeck.id ? { ...d, title: editTitle } : d));
        }

        setIsEditing(false);
        setEditingDeck(null);
    } catch (e) {
        alert("Erro ao atualizar o plano.");
        console.error(e);
    } finally {
        setIsGenerating(false);
    }
  };


  const handleSessionComplete = (results: { cardId: string; rating: Rating }[]) => {
    const now = Date.now();
    let xpGained = 0;

    // Update cards with SM-2 algorithm
    const updatedCards = cards.map(card => {
      const result = results.find(r => r.cardId === card.id);
      
      if (result) {
        const newSM2 = calculateSM2(card.sm2, result.rating);
        const nextDate = getNextReviewDate(newSM2.interval);
        
        xpGained += (result.rating * 10); 

        return {
          ...card,
          sm2: newSM2,
          lastReviewDate: now,
          nextReviewDate: nextDate
        };
      }
      return card;
    });

    setCards(updatedCards);

    // Update Deck Mastery Level (Improved Logic: Count cards with interval >= 1 as "Started/Known")
    if (activeDeckId) {
      const deckCards = updatedCards.filter(c => c.deckId === activeDeckId);
      // Fixed: Previously required interval > 21. Now, if interval >= 1 it means the user got it right at least once.
      // We can create tiers, but for a progress bar, checking if it's not "New" (interval 0) is better for immediate feedback.
      const masteredCount = deckCards.filter(c => c.sm2.interval >= 1).length;
      const currentDeckLevel = deckCards.length > 0 ? Math.round((masteredCount / deckCards.length) * 100) : 0;
      
      setDecks(prev => prev.map(d => d.id === activeDeckId ? { ...d, masteryLevel: currentDeckLevel } : d));
    }

    // Update Global Stats
    // Same logic: "Cards Mastered" now means "Cards Learned/Reviewed Successfully"
    const totalMastered = updatedCards.filter(c => c.sm2.interval >= 1).length;
    
    setStats(prev => {
        const isStreakContinue = prev.lastStudyDate && (now - prev.lastStudyDate < (48 * 60 * 60 * 1000));
        return {
            streak: isStreakContinue ? prev.streak + 1 : 1,
            lastStudyDate: now,
            totalXp: prev.totalXp + xpGained,
            cardsMastered: totalMastered
        };
    });

    setActiveDeckId(null);
    setView('dashboard');
  };

  // --- Render ---
  return (
    <div 
        className="min-h-screen transition-colors duration-500 ease-in-out font-sans"
        style={{ backgroundColor: appBg }}
    >
      {/* --- HEADER --- */}
      {view === 'dashboard' && (
        <header className="bg-white/90 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center sm:justify-between">
                <div className="flex items-center gap-3">
                    {/* Le Bombo Logo - Updated to match the requested Image */}
                    <div className="flex items-center gap-2.5 select-none cursor-pointer hover:opacity-90 transition-opacity group">
                        <div className="relative w-11 h-11 bg-black rounded-full flex items-center justify-center shadow-md overflow-visible">
                             {/* Bone vertical inside circle */}
                             <Bone 
                                className="text-white fill-white absolute top-3.5" 
                                size={22} 
                                strokeWidth={2.5} 
                                style={{ transform: 'rotate(90deg)' }}
                             />
                             {/* Graduation Cap on top, slightly overlapping the circle top */}
                             <GraduationCap 
                                className="text-white fill-black absolute -top-1.5 z-10" 
                                size={28} 
                                strokeWidth={2} 
                             />
                        </div>
                        <span className="text-xl font-extrabold text-slate-800 tracking-tight group-hover:text-brand-600 transition-colors">Lebombo</span>
                    </div>
                </div>
                
                <div className="hidden sm:flex items-center gap-4">
                    {/* Theme Picker */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowThemePicker(!showThemePicker)}
                            className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
                        >
                            <Palette size={20} />
                        </button>
                        {showThemePicker && (
                            <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 p-4 w-64 grid grid-cols-4 gap-2 z-50">
                                <p className="col-span-4 text-xs font-bold text-slate-400 mb-2 uppercase">Cor de Fundo</p>
                                {[
                                    '#f8fafc', // Slate
                                    '#f0fdf4', // Green
                                    '#eff6ff', // Blue
                                    '#faf5ff', // Purple
                                    '#fff1f2', // Rose
                                    '#fffbeb', // Amber
                                    '#ecfeff', // Cyan
                                    '#1e293b'  // Dark (Partial support)
                                ].map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => setAppBg(c)}
                                        className={`w-8 h-8 rounded-full border-2 ${appBg === c ? 'border-brand-600' : 'border-slate-200'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                                <div className="col-span-4 mt-2 pt-2 border-t border-slate-100">
                                    <label className="text-xs text-slate-500 block mb-1">Customizada</label>
                                    <input 
                                        type="color" 
                                        value={appBg}
                                        onChange={(e) => setAppBg(e.target.value)}
                                        className="w-full h-8 rounded cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={() => setView('creating')}
                        className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-all font-medium shadow-sm hover:shadow-md active:scale-95"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Novo Plano</span>
                    </button>
                </div>
            </div>
            
             {/* Mobile Controls */}
             <div className="sm:hidden px-6 pb-4 flex items-center justify-between gap-4">
                 <button 
                        onClick={() => setShowThemePicker(!showThemePicker)}
                        className="p-2 rounded-full bg-slate-100 text-slate-600"
                    >
                        <Palette size={20} />
                </button>
                 {showThemePicker && (
                            <div className="absolute left-6 mt-12 bg-white rounded-xl shadow-xl border border-slate-100 p-4 w-64 grid grid-cols-4 gap-2 z-50">
                                <p className="col-span-4 text-xs font-bold text-slate-400 mb-2 uppercase">Cor de Fundo</p>
                                {[
                                    '#f8fafc', // Slate
                                    '#f0fdf4', // Green
                                    '#eff6ff', // Blue
                                    '#faf5ff', // Purple
                                    '#fff1f2', // Rose
                                    '#fffbeb', // Amber
                                    '#ecfeff', // Cyan
                                    '#1e293b'  // Dark (Partial support)
                                ].map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => { setAppBg(c); setShowThemePicker(false); }}
                                        className={`w-8 h-8 rounded-full border-2 ${appBg === c ? 'border-brand-600' : 'border-slate-200'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                 )}
                 <button 
                    onClick={() => setView('creating')}
                    className="flex-1 flex items-center justify-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 font-medium shadow-sm"
                >
                    <Plus size={18} /> Novo Plano
                </button>
             </div>
        </header>
      )}

      {/* --- MAIN CONTENT --- */}
      <main className="pb-20">
        {view === 'dashboard' && (
          <Dashboard 
            decks={decks}
            folders={folders}
            currentFolderId={currentFolderId}
            stats={stats}
            studyLogs={[]} 
            onSelectDeck={startSession}
            onCreateDeck={() => setView('creating')}
            onViewGuide={openGuide}
            onDeleteDeck={handleDeleteDeck}
            onEditDeck={onEditDeck}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onEnterFolder={setCurrentFolderId}
            onMoveDeck={handleMoveDeck}
          />
        )}

        {view === 'creating' && (
          <div className="max-w-2xl mx-auto p-6 animate-in slide-in-from-bottom-8 duration-500">
             <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 font-medium">
                <ArrowLeft size={20} /> Cancelar
             </button>

             <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-800">Criar Novo Plano de Estudo</h2>
                    <p className="text-slate-500 mt-2">Escolha como deseja gerar seu material</p>
                </div>

                {/* Mode Selection */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                    <button 
                        onClick={() => setCreationMode('topic')}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                            creationMode === 'topic' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 hover:border-brand-200 text-slate-500'
                        }`}
                    >
                        <Book size={24} />
                        <span className="text-xs font-bold">Por Tópico</span>
                    </button>
                    <button 
                        onClick={() => setCreationMode('file')}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                            creationMode === 'file' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 hover:border-brand-200 text-slate-500'
                        }`}
                    >
                        <Upload size={24} />
                        <span className="text-xs font-bold">Arquivo/Texto</span>
                    </button>
                    <button 
                        onClick={() => setCreationMode('clinical')}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                            creationMode === 'clinical' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 hover:border-brand-200 text-slate-500'
                        }`}
                    >
                        <Stethoscope size={24} />
                        <span className="text-xs font-bold">Caso Clínico</span>
                    </button>
                </div>

                <div className="space-y-5">
                    {/* Title Input */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            {creationMode === 'clinical' ? 'Especialidade ou Patologia' : 'Título do Assunto'}
                        </label>
                        <input 
                            type="text"
                            value={newTopic}
                            onChange={(e) => setNewTopic(e.target.value)}
                            placeholder={creationMode === 'clinical' ? "Ex: Cardiologia, Diabetes Tipo 2..." : "Ex: Direito Constitucional, Física..."}
                            className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        />
                    </div>

                    {/* File/Text Input */}
                    {creationMode === 'file' && (
                        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Upload de Arquivo (PDF, DOCX, XLSX, TXT)</label>
                                <div className="relative group">
                                    <input 
                                        type="file" 
                                        accept=".pdf,.docx,.txt,.md,.xlsx,.xls,.csv"
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                    />
                                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center group-hover:border-brand-400 group-hover:bg-white transition-all">
                                        {isReadingFile ? (
                                            <div className="flex items-center justify-center gap-2 text-brand-600">
                                                <Loader2 className="animate-spin" /> Processando arquivo...
                                            </div>
                                        ) : (
                                            <div className="text-slate-500">
                                                <Upload className="mx-auto mb-2 opacity-50" />
                                                <span className="text-sm">Clique ou arraste um arquivo aqui</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 text-center">Para Google Docs, baixe como PDF ou Docx primeiro.</p>
                             </div>
                             
                             <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-slate-50 px-2 text-slate-400">Ou cole o texto</span>
                                </div>
                             </div>

                             <textarea 
                                value={customContent}
                                onChange={(e) => setCustomContent(e.target.value)}
                                placeholder="Cole seu texto de estudo aqui..."
                                className="w-full h-32 p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                             />
                        </div>
                    )}

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Nível Acadêmico</label>
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button 
                                    onClick={() => setNewLevel('Graduação')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${newLevel === 'Graduação' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Graduação
                                </button>
                                <button 
                                    onClick={() => setNewLevel('Pós-Graduação')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${newLevel === 'Pós-Graduação' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Pós-Grad.
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Idioma</label>
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button 
                                    onClick={() => setLanguage('pt')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${language === 'pt' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Português
                                </button>
                                <button 
                                    onClick={() => setLanguage('es')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${language === 'es' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Español
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Formato das Questões</label>
                        <div className="grid grid-cols-3 gap-2">
                             <button 
                                onClick={() => setQuestionFormat('multiple_choice')}
                                className={`py-2 px-2 text-xs font-medium rounded-lg border flex flex-col items-center gap-1 ${
                                    questionFormat === 'multiple_choice' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                             >
                                <CheckSquare size={16} /> Múltipla Escolha
                             </button>
                             <button 
                                onClick={() => setQuestionFormat('open')}
                                className={`py-2 px-2 text-xs font-medium rounded-lg border flex flex-col items-center gap-1 ${
                                    questionFormat === 'open' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                             >
                                <AlignLeft size={16} /> Dissertativa
                             </button>
                             <button 
                                onClick={() => setQuestionFormat('mixed')}
                                className={`py-2 px-2 text-xs font-medium rounded-lg border flex flex-col items-center gap-1 ${
                                    questionFormat === 'mixed' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                             >
                                <Layers size={16} /> Misto
                             </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                             Instruções Personalizadas (Prompt)
                        </label>
                        <textarea
                            value={customInstructions}
                            onChange={(e) => setCustomInstructions(e.target.value)}
                            placeholder="Ex: Foque apenas em datas históricas; Use linguagem técnica avançada; Crie perguntas estilo OAB..."
                            className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm h-24"
                        />
                    </div>

                    <button 
                        onClick={handleCreateDeck}
                        disabled={isGenerating || !newTopic}
                        className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-brand-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="animate-spin" />
                                <span className="animate-pulse">{creationMode === 'file' ? 'Lendo e Gerando...' : 'Criando Material...'}</span>
                            </>
                        ) : (
                            'Gerar Plano de Estudo'
                        )}
                    </button>
                    
                    {creationMode === 'clinical' && (
                        <p className="text-xs text-center text-slate-400">
                           O sistema criará casos simulados para treinamento de raciocínio clínico.
                        </p>
                    )}
                </div>
             </div>
          </div>
        )}

        {view === 'study' && activeDeckId && (
          <StudySession 
            deckTitle={decks.find(d => d.id === activeDeckId)?.title || ''}
            cards={studySessionCards}
            onCompleteSession={handleSessionComplete}
            onExit={() => { setActiveDeckId(null); setView('dashboard'); }}
            backgroundColor={appBg}
          />
        )}

        {view === 'guide' && activeDeckId && (
           <div className="max-w-4xl mx-auto p-6 animate-in fade-in duration-500">
               <div className="bg-white rounded-2xl shadow-xl overflow-hidden min-h-screen flex flex-col">
                   <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
                       <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium">
                           <ArrowLeft size={20} /> Voltar
                       </button>
                       <h2 className="font-bold text-lg text-slate-800 truncate max-w-md">
                           {decks.find(d => d.id === activeDeckId)?.title}
                       </h2>
                       <button 
                           onClick={() => startSession(activeDeckId)}
                           className="bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-700"
                       >
                           Estudar Agora
                       </button>
                   </div>
                   <div className="p-8 md:p-12 prose prose-slate max-w-none">
                       {/* Render HTML Safely */}
                       <div 
                          dangerouslySetInnerHTML={{ 
                              __html: decks.find(d => d.id === activeDeckId)?.studyGuide || 
                              "<div class='text-center text-slate-400 py-20'>Nenhum guia disponível para este tópico.</div>" 
                          }} 
                       />
                   </div>
               </div>
           </div>
        )}
      </main>

       {/* --- MODALS --- */}
       
       {/* Edit Modal */}
       {isEditing && (
           <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
               <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                           <Pencil size={20} className="text-brand-500"/> Editar Plano
                       </h3>
                       <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
                           <X size={24} />
                       </button>
                   </div>

                   <div className="space-y-4">
                       <div>
                           <label className="block text-sm font-semibold text-slate-700 mb-1">Título</label>
                           <input 
                               value={editTitle}
                               onChange={(e) => setEditTitle(e.target.value)}
                               className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                           />
                       </div>

                       <div>
                           <div className="flex items-center justify-between mb-2">
                               <label className="block text-sm font-semibold text-slate-700">Formato das Questões</label>
                               <div className="flex items-center gap-2">
                                   <input 
                                     type="checkbox" 
                                     id="regen"
                                     checked={regenerateOnEdit}
                                     onChange={(e) => setRegenerateOnEdit(e.target.checked)}
                                     className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                   />
                                   <label htmlFor="regen" className="text-xs text-brand-600 font-bold cursor-pointer select-none">
                                       Regenerar Conteúdo?
                                   </label>
                               </div>
                           </div>
                           
                           <div className={`grid grid-cols-3 gap-2 transition-opacity ${regenerateOnEdit ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                <button 
                                   onClick={() => setEditFormat('multiple_choice')}
                                   className={`p-2 text-xs font-medium rounded border flex flex-col items-center gap-1 ${editFormat === 'multiple_choice' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200'}`}
                                >
                                   <CheckSquare size={14} /> Múltipla
                                </button>
                                <button 
                                   onClick={() => setEditFormat('open')}
                                   className={`p-2 text-xs font-medium rounded border flex flex-col items-center gap-1 ${editFormat === 'open' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200'}`}
                                >
                                   <AlignLeft size={14} /> Dissert.
                                </button>
                                <button 
                                   onClick={() => setEditFormat('mixed')}
                                   className={`p-2 text-xs font-medium rounded border flex flex-col items-center gap-1 ${editFormat === 'mixed' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200'}`}
                                >
                                   <Layers size={14} /> Misto
                                </button>
                           </div>
                           {regenerateOnEdit && (
                               <p className="text-[10px] text-red-500 mt-2 leading-tight">
                                   Atenção: Regenerar irá apagar seu progresso atual neste deck e criar novas perguntas.
                               </p>
                           )}
                       </div>

                       <button 
                           onClick={handleSaveEdit}
                           disabled={isGenerating}
                           className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold mt-4 hover:bg-brand-700 disabled:opacity-50 flex justify-center gap-2"
                       >
                           {isGenerating ? <Loader2 className="animate-spin"/> : 'Salvar Alterações'}
                       </button>
                   </div>
               </div>
           </div>
       )}

       {/* Footer */}
       {view === 'dashboard' && (
           <footer className="text-center py-8 text-slate-300 text-xs font-medium">
               BY: Ivan
           </footer>
       )}

    </div>
  );
};

export default App;
