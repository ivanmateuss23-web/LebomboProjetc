
import React, { useState, useEffect, useRef } from 'react';
import { Card, QuestionType, Rating } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, HelpCircle, Brain, ChevronRight, Send, RefreshCw, AlertCircle, Clock, SkipForward, X, RotateCcw, History } from 'lucide-react';
import { evaluateAnswer, AIFeedback } from '../services/geminiService';

interface StudySessionProps {
  deckTitle: string;
  cards: Card[];
  onCompleteSession: (results: { cardId: string; rating: Rating }[]) => void;
  onExit: () => void;
  backgroundColor?: string;
}

// Helper to shuffle array (Fisher-Yates)
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

interface ReviewData {
    card: Card;
    userAnswer: string;
    feedback: AIFeedback | null;
}

const StudySession: React.FC<StudySessionProps> = ({ deckTitle, cards, onCompleteSession, onExit, backgroundColor = '#f8fafc' }) => {
  // Queue now holds the cards to be studied
  const [queue, setQueue] = useState<Card[]>([]);
  
  // Track how many times a card has been answered CORRECTLY in this session
  const [sessionSuccessCounts, setSessionSuccessCounts] = useState<{ [key: string]: number }>({});
  
  // Total unique cards for progress calculation
  const totalUniqueCards = useRef(cards.length);
  // Set of IDs that have reached the success threshold
  const [masteredInSession, setMasteredInSession] = useState<Set<string>>(new Set());
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);
  
  // --- New States for History ---
  const [lastReviewData, setLastReviewData] = useState<ReviewData | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // --- Matching Game State ---
  const [matchingMatches, setMatchingMatches] = useState<Record<string, string>>({}); // Left ID -> Right ID
  const [matchingSelectedLeft, setMatchingSelectedLeft] = useState<string | null>(null);
  const [shuffledRightItems, setShuffledRightItems] = useState<string[]>([]);
  
  // Timer State
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Stores final results
  const [sessionResults, setSessionResults] = useState<{ cardId: string; rating: Rating }[]>([]);

  // Initialize: Shuffle cards on mount
  useEffect(() => {
    setQueue(shuffleArray(cards));
    totalUniqueCards.current = cards.length;
    
    // Initialize counts
    const initialCounts: { [key: string]: number } = {};
    cards.forEach(c => initialCounts[c.id] = 0);
    setSessionSuccessCounts(initialCounts);
  }, [cards]);

  const currentCard = queue[currentIndex];

  // Initialize Matching Items specific to current card
  useEffect(() => {
    if (currentCard?.type === QuestionType.MATCHING && currentCard.matchingPairs) {
        setShuffledRightItems(shuffleArray(currentCard.matchingPairs.map(p => p.right)));
        setMatchingMatches({});
        setMatchingSelectedLeft(null);
    }
  }, [currentCard]);

  // Sync Matching matches to UserAnswer string for history/display purposes
  useEffect(() => {
    if (currentCard?.type === QuestionType.MATCHING) {
        const pairStrings = Object.entries(matchingMatches).map(([l, r]) => `${l} -> ${r}`);
        setUserAnswer(pairStrings.join('\n'));
    }
  }, [matchingMatches, currentCard]);
  
  const progressPct = Math.round((masteredInSession.size / totalUniqueCards.current) * 100);

  // --- Timer Logic ---
  const playAlarm = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) {
      console.error("Audio error", e);
    }
  };

  const startTimer = (minutes: number) => {
    setTimeLimit(minutes * 60);
    setTimeLeft(minutes * 60);
    setIsTimerRunning(true);
    setShowTimerMenu(false);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    setTimeLimit(null);
    setTimeLeft(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            playAlarm();
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
        setIsTimerRunning(false);
        playAlarm();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Skip Logic ---
  const handleSkip = () => {
    if (queue.length <= 1) return; // Can't skip if last one
    
    // Move current card to end of queue
    const nextQueue = [...queue];
    const skipped = nextQueue.splice(currentIndex, 1)[0];
    nextQueue.push(skipped);
    
    setQueue(nextQueue);
    resetCardState();
  };

  // --- Matching Game Logic ---
  const handleMatchingLeftClick = (left: string) => {
      if (matchingMatches[left]) return; // Already matched
      setMatchingSelectedLeft(left);
  };

  const handleMatchingRightClick = (right: string) => {
      if (!matchingSelectedLeft) return;
      // Assign match
      setMatchingMatches(prev => ({
          ...prev,
          [matchingSelectedLeft]: right
      }));
      setMatchingSelectedLeft(null);
  };

  const handleMatchingResetPair = (left: string) => {
      const newMatches = {...matchingMatches};
      delete newMatches[left];
      setMatchingMatches(newMatches);
  };


  const handleCheckAnswer = async (immediateAnswer?: string) => {
    // If an immediate answer is passed (click), use it. Otherwise use state.
    const answerToCheck = immediateAnswer || userAnswer;
    
    // Ensure state is updated for display purposes if immediate answer was provided
    if (immediateAnswer) {
        setUserAnswer(immediateAnswer);
    }

    // Basic validation
    if (currentCard.type !== QuestionType.MATCHING && !answerToCheck.trim()) {
      setIsFlipped(true); // Allow flip without answer for thinking
      return;
    }

    setIsEvaluating(true);
    
    let feedback: AIFeedback = { score: 0, feedback: '', isCorrect: false };

    // 1. Multiple Choice Local Check
    if (currentCard.type === QuestionType.MULTIPLE_CHOICE) {
        const isMatch = currentCard.back.toLowerCase().includes(answerToCheck.toLowerCase()) || 
                        answerToCheck.toLowerCase().includes(currentCard.back.toLowerCase());
        
        feedback = {
            score: isMatch ? 5 : 1,
            feedback: isMatch ? "Resposta correta!" : `Incorreto. A resposta certa é: ${currentCard.back}`,
            isCorrect: isMatch
        };
    } 
    // 2. True / False Local Check
    else if (currentCard.type === QuestionType.TRUE_FALSE) {
        const isMatch = answerToCheck.toLowerCase() === currentCard.back.toLowerCase();
        
        feedback = {
            score: isMatch ? 5 : 1,
            feedback: isMatch ? "Correto!" : `Incorreto. A afirmação é ${currentCard.back}.`,
            isCorrect: isMatch
        };
    }
    // 3. Matching Local Check
    else if (currentCard.type === QuestionType.MATCHING) {
        let correctCount = 0;
        let totalPairs = currentCard.matchingPairs?.length || 0;
        
        // Note: userAnswer is already synced via useEffect

        if (currentCard.matchingPairs) {
            currentCard.matchingPairs.forEach(pair => {
                if (matchingMatches[pair.left] === pair.right) {
                    correctCount++;
                }
            });
        }

        const isPerfect = correctCount === totalPairs;
        const score = isPerfect ? 5 : (correctCount > 0 ? 2 : 0);

        feedback = {
            score: score as Rating,
            feedback: isPerfect ? "Perfeito! Todas as associações estão corretas." : `Você acertou ${correctCount} de ${totalPairs} associações.`,
            isCorrect: isPerfect
        };
    }
    // 4. Concept Card (Open) - AI Check
    else {
        feedback = await evaluateAnswer(currentCard.front, currentCard.back, answerToCheck);
    }

    setAiFeedback(feedback);
    setIsEvaluating(false);

    // --- Logic for Immediate Advance vs Explanation ---
    
    // Check if it's an objective question type
    const isObjective = (
         currentCard.type === QuestionType.MULTIPLE_CHOICE || 
         currentCard.type === QuestionType.TRUE_FALSE || 
         currentCard.type === QuestionType.MATCHING
    );

    if (isObjective && feedback.isCorrect) {
        // If correct AND objective: Skip explanation, rate immediately as 5 (Perfect)
        // We pass feedback directly because setAiFeedback is async and handleRating needs it now
        handleRating(5, feedback);
    } else {
        // If incorrect OR open-ended: Show explanation
        setIsFlipped(true);
    }
  };

  const handleRating = (rating: Rating, overrideFeedback?: AIFeedback) => {
    // Use overrideFeedback if provided (for instant transitions), otherwise use state
    const feedbackToSave = overrideFeedback || aiFeedback;

    // 1. Save History before moving
    setLastReviewData({
        card: currentCard,
        userAnswer: userAnswer,
        feedback: feedbackToSave
    });

    const newResults = sessionResults.filter(r => r.cardId !== currentCard.id);
    newResults.push({ cardId: currentCard.id, rating });
    setSessionResults(newResults);

    const currentSuccessCount = sessionSuccessCounts[currentCard.id] || 0;
    const REQUIRED_SUCCESSES = 2; 

    let nextQueue = [...queue];
    nextQueue.splice(currentIndex, 1);

    if (rating < 3) {
      setSessionSuccessCounts(prev => ({ ...prev, [currentCard.id]: 0 }));
      const insertIndex = Math.min(nextQueue.length, currentIndex + 2 + Math.floor(Math.random() * 2));
      nextQueue.splice(insertIndex, 0, currentCard);
      if (currentIndex >= nextQueue.length) setCurrentIndex(0);
    } else {
      const newCount = currentSuccessCount + 1;
      setSessionSuccessCounts(prev => ({ ...prev, [currentCard.id]: newCount }));

      if (newCount < REQUIRED_SUCCESSES) {
        const randomFutureIndex = currentIndex + 2 + Math.floor(Math.random() * (nextQueue.length - currentIndex));
        const safeIndex = Math.min(nextQueue.length, Math.max(0, randomFutureIndex));
        nextQueue.splice(safeIndex, 0, currentCard);
        if (currentIndex >= nextQueue.length) setCurrentIndex(0);
      } else {
        setMasteredInSession(prev => new Set(prev).add(currentCard.id));
        if (nextQueue.length === 0) {
            setQueue([]);
            onCompleteSession(newResults);
            return;
        }
        if (currentIndex >= nextQueue.length) setCurrentIndex(0);
      }
    }

    setQueue(nextQueue);
    resetCardState();
  };

  const resetCardState = () => {
    setIsFlipped(false);
    setUserAnswer('');
    setAiFeedback(null);
    setIsEvaluating(false);
    setMatchingMatches({});
    setMatchingSelectedLeft(null);
  };

  const RatingButton = ({ rating, label, color, shortcut }: { rating: Rating, label: string, color: string, shortcut?: string }) => (
    <button
      onClick={() => handleRating(rating)}
      className={`flex-1 py-3 px-2 rounded-xl font-semibold text-sm transition-transform active:scale-95 border-b-4 ${color}`}
    >
      <div className="flex flex-col items-center">
        <span>{label}</span>
        {shortcut && <span className="text-[10px] opacity-60 mt-1 font-normal">({shortcut})</span>}
      </div>
    </button>
  );

  if (!currentCard) {
    return (
      <div 
        className="flex flex-col items-center justify-center h-screen text-slate-600"
        style={{ backgroundColor: backgroundColor }}
      >
        <h2 className="text-xl font-bold mb-2">Sessão Finalizada!</h2>
        <p className="text-slate-400 mb-6">Parabéns pelo esforço.</p>
        <button onClick={onExit} className="px-6 py-2 bg-brand-600 text-white rounded-lg">Voltar ao Dashboard</button>
      </div>
    );
  }

  const currentCardSuccess = sessionSuccessCounts[currentCard.id] || 0;

  return (
    <div 
      className="min-h-screen flex flex-col relative transition-colors duration-300"
      style={{ backgroundColor: backgroundColor }}
    >
      {/* History Modal */}
      {showHistoryModal && lastReviewData && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative animate-in zoom-in-95">
                <button onClick={() => setShowHistoryModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
                    <X size={24} />
                </button>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <History size={20} className="text-brand-500" /> Revisar Anterior
                </h3>
                
                <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl">
                        <span className="text-xs font-bold text-slate-400 uppercase">Pergunta</span>
                        <p className="text-slate-800 font-medium">{lastReviewData.card.front}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`p-4 rounded-xl border ${lastReviewData.feedback?.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <span className="text-xs font-bold uppercase opacity-60 mb-1 block">Sua Resposta</span>
                            <p className="text-sm whitespace-pre-line">{lastReviewData.userAnswer || "(Sem resposta)"}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200">
                             <span className="text-xs font-bold uppercase text-slate-400 mb-1 block">Gabarito</span>
                             {lastReviewData.card.type === QuestionType.MATCHING && lastReviewData.card.matchingPairs ? (
                                <ul className="text-sm space-y-1">
                                    {lastReviewData.card.matchingPairs.map((p, i) => (
                                        <li key={i}><span className="font-bold">{p.left}</span> → {p.right}</li>
                                    ))}
                                </ul>
                             ) : (
                                <p className="text-sm">{lastReviewData.card.back}</p>
                             )}
                        </div>
                    </div>

                    {lastReviewData.card.explanation && (
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                             <span className="text-xs font-bold text-indigo-400 uppercase mb-1 block">Explicação</span>
                             <p className="text-sm text-indigo-900 leading-relaxed">{lastReviewData.card.explanation}</p>
                        </div>
                    )}
                </div>
                
                <div className="mt-6 flex justify-end">
                    <button onClick={() => setShowHistoryModal(false)} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
      )}
      
      {/* Timer Alert */}
      {timeLeft === 0 && timeLimit !== null && !isTimerRunning && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 animate-bounce">
                    <Clock size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Tempo Esgotado!</h3>
                <p className="text-slate-500 mb-8">O tempo definido para sua sessão acabou.</p>
                <button 
                    onClick={() => { setTimeLimit(null); }}
                    className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors"
                >
                    Continuar Estudando
                </button>
            </motion.div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-sm z-10 sticky top-0">
        <button onClick={onExit} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100">
          <ArrowLeft size={20} />
        </button>
        
        <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
                <span className="text-sm font-medium text-slate-500 uppercase tracking-wide truncate max-w-[150px] sm:max-w-[200px]">{deckTitle}</span>
                <div className="flex items-center gap-2 text-xs text-brand-600 font-bold">
                    <span className="bg-brand-50 px-3 py-0.5 rounded-full shadow-sm border border-brand-100">
                        {progressPct}% Concluído
                    </span>
                </div>
            </div>

            <div className="relative flex gap-2">
                {/* Previous Card Button - Only shows if history exists */}
                {lastReviewData && (
                    <button 
                        onClick={() => setShowHistoryModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border text-slate-500 border-slate-200 hover:bg-slate-50"
                        title="Ver resposta anterior"
                    >
                        <RotateCcw size={16} /> 
                        <span className="hidden sm:inline">Anterior</span>
                    </button>
                )}

                {/* Skip Button */}
                <button 
                    onClick={handleSkip}
                    disabled={queue.length <= 1}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border text-slate-500 border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                    title="Pular pergunta (deixar para depois)"
                >
                    <SkipForward size={16} /> 
                    <span className="hidden sm:inline">Pular</span>
                </button>

                {/* Timer Control */}
                <div className="relative">
                    <button 
                        onClick={() => setShowTimerMenu(!showTimerMenu)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                            isTimerRunning 
                                ? (timeLeft < 60 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-blue-50 text-blue-600 border-blue-200') 
                                : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <Clock size={16} />
                        {isTimerRunning ? formatTime(timeLeft) : <span className="hidden sm:inline">Timer</span>}
                    </button>
                    {showTimerMenu && (
                         <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-xl border border-slate-100 p-2 min-w-[160px] z-20 overflow-hidden">
                             <p className="text-[10px] font-bold text-slate-400 px-3 py-2 uppercase tracking-wider">Definir Tempo</p>
                             {[5, 15, 30, 45, 60].map(min => (
                                 <button key={min} onClick={() => startTimer(min)} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-600 rounded-lg transition-colors">{min} minutos</button>
                             ))}
                             {isTimerRunning && (
                                 <div className="pt-1 mt-1 border-t border-slate-100">
                                     <button onClick={stopTimer} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">Parar Timer</button>
                                 </div>
                             )}
                         </div>
                    )}
                </div>
            </div>
        </div>
        
        <div className="w-8 hidden sm:block" />
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-slate-200 w-full">
        <motion.div 
          className="h-full bg-brand-500" 
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Main Card Area */}
      <div className="flex-1 flex flex-col items-center p-4 max-w-4xl mx-auto w-full gap-6">
        
        {/* Question Card */}
        <div className="w-full bg-yellow-100 rounded-2xl shadow-sm border border-yellow-200 p-6 md:p-10 relative overflow-hidden">
             <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    currentCard.difficulty === 'Básico' ? 'bg-green-100 text-green-700' :
                    currentCard.difficulty === 'Intermediário' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-red-100 text-red-700'
                    }`}>
                    {currentCard.difficulty}
                    </span>
                    {/* Session Status Dot */}
                    {currentCardSuccess === 1 && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700 flex items-center gap-1">
                            <RefreshCw size={10} /> Revisão
                        </span>
                    )}
                </div>
                <span className="text-yellow-700/50">
                  <HelpCircle size={20} />
                </span>
              </div>

              <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight mb-4">
                {currentCard.front}
              </h2>

              {/* Multiple Choice UI */}
              {currentCard.type === QuestionType.MULTIPLE_CHOICE && currentCard.options && !isFlipped && (
                 <div className="space-y-2 mt-4">
                    {currentCard.options.map((opt, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handleCheckAnswer(opt)}
                        disabled={isEvaluating}
                        className={`w-full p-4 border rounded-xl text-left transition-all flex items-start gap-3 group bg-white/80 hover:bg-white ${
                            userAnswer === opt 
                            ? 'border-brand-500 ring-1 ring-brand-500' 
                            : 'border-yellow-300/50 hover:border-yellow-400'
                        }`}
                      >
                         <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold ${
                             userAnswer === opt ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300 text-slate-500 group-hover:border-slate-400'
                         }`}>
                             {String.fromCharCode(65 + idx)}
                         </div>
                         <span className="text-slate-700 font-medium">{opt}</span>
                      </button>
                    ))}
                 </div>
              )}

              {/* True / False UI */}
              {currentCard.type === QuestionType.TRUE_FALSE && !isFlipped && (
                  <div className="grid grid-cols-2 gap-4 mt-8">
                      <button 
                        onClick={() => handleCheckAnswer('Verdadeiro')}
                        disabled={isEvaluating}
                        className={`p-6 rounded-xl border-2 text-lg font-bold transition-all ${
                            userAnswer === 'Verdadeiro' 
                            ? 'border-green-500 bg-green-50 text-green-700' 
                            : 'border-green-200 bg-white hover:bg-green-50 text-green-600'
                        }`}
                      >
                          Verdadeiro
                      </button>
                      <button 
                        onClick={() => handleCheckAnswer('Falso')}
                        disabled={isEvaluating}
                        className={`p-6 rounded-xl border-2 text-lg font-bold transition-all ${
                            userAnswer === 'Falso' 
                            ? 'border-red-500 bg-red-50 text-red-700' 
                            : 'border-red-200 bg-white hover:bg-red-50 text-red-600'
                        }`}
                      >
                          Falso
                      </button>
                  </div>
              )}

              {/* Matching UI */}
              {currentCard.type === QuestionType.MATCHING && currentCard.matchingPairs && !isFlipped && (
                  <div className="mt-6 flex flex-col md:flex-row gap-8">
                      {/* Left Column (Terms) */}
                      <div className="flex-1 space-y-2">
                          <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Termos</h4>
                          {currentCard.matchingPairs.map(pair => {
                              const isMatched = !!matchingMatches[pair.left];
                              const isSelected = matchingSelectedLeft === pair.left;
                              return (
                                  <div key={pair.left} className="relative">
                                     <button
                                        onClick={() => handleMatchingLeftClick(pair.left)}
                                        disabled={isMatched || isEvaluating}
                                        className={`w-full p-3 text-sm text-left rounded-lg border-2 transition-all ${
                                            isMatched 
                                            ? 'bg-green-50 border-green-200 text-green-800'
                                            : isSelected 
                                                ? 'bg-brand-50 border-brand-500 text-brand-800'
                                                : 'bg-white border-slate-200 hover:border-brand-200'
                                        }`}
                                     >
                                        {pair.left}
                                     </button>
                                     {isMatched && (
                                         <button 
                                            onClick={() => handleMatchingResetPair(pair.left)}
                                            disabled={isEvaluating}
                                            className="absolute -right-2 -top-2 bg-red-100 text-red-500 rounded-full p-0.5 shadow-sm hover:bg-red-200"
                                         >
                                             <X size={12}/>
                                         </button>
                                     )}
                                  </div>
                              );
                          })}
                      </div>

                      {/* Right Column (Definitions - Shuffled) */}
                      <div className="flex-1 space-y-2">
                           <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Definições</h4>
                           {shuffledRightItems.map((rightItem, idx) => {
                               // Check if this item is already assigned to a left item
                               const matchedLeft = Object.keys(matchingMatches).find(key => matchingMatches[key] === rightItem);
                               const isAssigned = !!matchedLeft;

                               return (
                                   <button
                                      key={idx}
                                      onClick={() => handleMatchingRightClick(rightItem)}
                                      disabled={(isAssigned && !matchingSelectedLeft) || isEvaluating} 
                                      className={`w-full p-3 text-sm text-left rounded-lg border-2 transition-all ${
                                          isAssigned
                                          ? 'bg-green-50 border-green-200 text-green-800 opacity-60'
                                          : matchingSelectedLeft 
                                            ? 'bg-white border-brand-200 hover:bg-brand-50 cursor-pointer animate-pulse'
                                            : 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'
                                      }`}
                                   >
                                      {rightItem}
                                   </button>
                               );
                           })}
                      </div>
                  </div>
              )}
        </div>

        {/* Answer Section */}
        <div className="w-full max-w-4xl space-y-4 pb-10">
            {!isFlipped ? (
                // Only show verify container for complex types (Open Ended or Matching)
                // For Multiple Choice and True/False, the interaction is instant on click
                (currentCard.type === QuestionType.CONCEPT_CARD || currentCard.type === QuestionType.MATCHING) && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        {/* Open Text Input for Concept Cards Only */}
                        {currentCard.type === QuestionType.CONCEPT_CARD && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Sua Resposta</label>
                                <textarea
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    placeholder="Digite sua resposta aqui para o Lebombo avaliar..."
                                    className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none min-h-[120px] bg-white"
                                />
                            </div>
                        )}
                        
                        <button
                            onClick={() => handleCheckAnswer()}
                            disabled={isEvaluating}
                            className="w-full bg-slate-900 text-white font-bold text-lg py-3 rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isEvaluating ? (
                                <>Avaliando... <RefreshCw className="animate-spin" size={20}/></>
                            ) : (
                                <>Verificar Resposta <Send size={20} /></>
                            )}
                        </button>
                    </div>
                )
            ) : (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    {/* Comparison View */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`p-5 rounded-2xl border-2 ${
                            aiFeedback?.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                        }`}>
                            <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2 flex items-center gap-2">
                                {aiFeedback?.isCorrect ? <Check size={14}/> : <AlertCircle size={14}/>}
                                Sua Resposta
                            </h3>
                            <p className="text-slate-800 text-lg whitespace-pre-wrap font-medium">
                                {userAnswer || <span className="italic text-slate-400">(Sem resposta / Incompleto)</span>}
                            </p>
                            {aiFeedback && (
                                <div className="mt-4 pt-4 border-t border-black/10">
                                    <p className="text-sm font-semibold mb-1">Análise do Lebombo:</p>
                                    <p className="text-sm italic opacity-80">{aiFeedback.feedback}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                         <div className="flex-1 h-2 bg-black/10 rounded-full overflow-hidden">
                                             <div 
                                                className={`h-full rounded-full ${aiFeedback.score >= 3 ? 'bg-green-500' : 'bg-red-500'}`} 
                                                style={{ width: `${(aiFeedback.score / 5) * 100}%` }} 
                                             />
                                         </div>
                                         <span className="text-xs font-bold">{Math.round((aiFeedback.score / 5) * 100)}%</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200">
                             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Gabarito Oficial</h3>
                             {currentCard.type === QuestionType.MATCHING && currentCard.matchingPairs ? (
                                <ul className="space-y-2">
                                    {currentCard.matchingPairs.map((p, i) => (
                                        <li key={i} className="text-sm border-b border-slate-100 pb-1 last:border-0">
                                            <span className="font-bold text-slate-700">{p.left}</span>
                                            <span className="text-slate-400 mx-2">→</span>
                                            <span className="text-slate-600">{p.right}</span>
                                        </li>
                                    ))}
                                </ul>
                             ) : (
                                <p className="text-slate-800 text-lg font-medium">{currentCard.back}</p>
                             )}
                             
                             {currentCard.explanation && (
                                <div className="mt-4 bg-indigo-50 p-3 rounded-lg text-sm text-indigo-800">
                                    <span className="font-bold block mb-1">Explicação:</span>
                                    {currentCard.explanation}
                                </div>
                             )}
                        </div>
                    </div>

                    {/* Rating Controls */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-lg">
                        <div className="grid grid-cols-4 gap-3">
                        <RatingButton 
                            rating={1} 
                            label="Errei" 
                            color="bg-red-100 text-red-700 border-red-200 hover:bg-red-200" 
                        />
                        <RatingButton 
                            rating={3} 
                            label="Na Trave" 
                            color="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200" 
                        />
                        <RatingButton 
                            rating={4} 
                            label="Bom" 
                            color="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200" 
                        />
                        <RatingButton 
                            rating={5} 
                            label="Perfeito" 
                            color="bg-green-100 text-green-700 border-green-200 hover:bg-green-200" 
                        />
                        </div>
                        {(!aiFeedback?.isCorrect && (aiFeedback?.score ?? 0) < 3) && (
                            <p className="text-center text-xs text-red-500 mt-2 font-medium flex items-center justify-center gap-1">
                                <RefreshCw size={12}/> Vamos insistir nesta questão. Ela voltará em breve!
                            </p>
                        )}
                        {(aiFeedback?.isCorrect || (aiFeedback?.score ?? 0) >= 3) && currentCardSuccess === 0 && (
                             <p className="text-center text-xs text-blue-500 mt-2 font-medium flex items-center justify-center gap-1">
                                <RefreshCw size={12}/> Muito bem! Acerte mais 1 vez para concluir este card.
                            </p>
                        )}
                    </div>
                </motion.div>
            )}
        </div>
      </div>
    </div>
  );
};

export default StudySession;
