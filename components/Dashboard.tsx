import React, { useState } from 'react';
import { Deck, UserStats, Folder } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { BookOpen, Trophy, Activity, Calendar, PlusCircle, Play, FileText, Trash2, Folder as FolderIcon, FolderPlus, ArrowLeft, FolderInput, X, Pencil } from 'lucide-react';

interface DashboardProps {
  decks: Deck[];
  folders: Folder[];
  currentFolderId: string | null;
  stats: UserStats;
  studyLogs: { date: string; count: number }[];
  onSelectDeck: (deckId: string) => void;
  onCreateDeck: () => void;
  onViewGuide: (deckId: string) => void;
  onDeleteDeck: (deckId: string) => void;
  onEditDeck: (deckId: string) => void;
  // Folder Actions
  onCreateFolder: (name: string) => void;
  onEnterFolder: (folderId: string | null) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveDeck: (deckId: string, targetFolderId: string | null) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  decks, folders, currentFolderId, stats, studyLogs, 
  onSelectDeck, onCreateDeck, onViewGuide, onDeleteDeck, onEditDeck,
  onCreateFolder, onEnterFolder, onDeleteFolder, onMoveDeck
}) => {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [movingDeckId, setMovingDeckId] = useState<string | null>(null);

  const currentFolder = folders.find(f => f.id === currentFolderId);
  
  // Filter decks for current view
  const visibleDecks = decks.filter(d => {
    if (currentFolderId) return d.folderId === currentFolderId;
    return !d.folderId; // Show decks with no folder in root
  });

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName);
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Welcome & High Level Stats */}
      {currentFolderId === null && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-50 rounded-full text-brand-600">
              <Trophy size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Nível de Domínio</p>
              <p className="text-2xl font-bold text-slate-800">{stats.cardsMastered}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-orange-50 rounded-full text-orange-600">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Sequência (Dias)</p>
              <p className="text-2xl font-bold text-slate-800">{stats.streak} 🔥</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total XP</p>
              <p className="text-2xl font-bold text-slate-800">{stats.totalXp}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
              <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Último Estudo</p>
                <p className="text-lg font-bold text-slate-800">
                  {stats.lastStudyDate ? new Date(stats.lastStudyDate).toLocaleDateString() : 'Hoje'}
                </p>
              </div>
          </div>
        </div>
      )}

      {/* Move Deck Modal */}
      {movingDeckId && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800">Mover para...</h3>
                    <button onClick={() => setMovingDeckId(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <div className="space-y-2">
                    <button 
                        onClick={() => { onMoveDeck(movingDeckId, null); setMovingDeckId(null); }}
                        className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-50 border border-slate-100 flex items-center gap-2"
                    >
                        <BookOpen size={16} className="text-slate-400"/> <span>Raiz (Início)</span>
                    </button>
                    {folders.map(f => (
                        <button 
                            key={f.id}
                            onClick={() => { onMoveDeck(movingDeckId, f.id); setMovingDeckId(null); }}
                            className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-50 border border-slate-100 flex items-center gap-2"
                        >
                            <FolderIcon size={16} className="text-brand-400"/> <span>{f.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Navigation & Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
                {currentFolderId && (
                    <button 
                        onClick={() => onEnterFolder(null)}
                        className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 text-slate-600 mr-2"
                        title="Voltar ao início"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    {currentFolderId ? (
                        <>
                            <FolderIcon className="text-brand-500 fill-brand-100" />
                            {currentFolder?.name}
                        </>
                    ) : 'Meus Planos de Estudo'}
                </h2>
            </div>
            
            <div className="flex gap-2">
                 {!currentFolderId && (
                    isCreatingFolder ? (
                        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-brand-200 shadow-sm animate-in fade-in slide-in-from-right-4">
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Nome da pasta..." 
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                className="px-2 py-1 outline-none text-sm w-32"
                                onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                            />
                            <button onClick={handleCreateFolder} className="p-1 text-green-600 hover:bg-green-50 rounded"><PlusCircle size={18}/></button>
                            <button onClick={() => setIsCreatingFolder(false)} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={18}/></button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsCreatingFolder(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-brand-300 transition-colors shadow-sm text-sm"
                        >
                            <FolderPlus size={16} /> Nova Pasta
                        </button>
                    )
                 )}
                <button 
                    onClick={onCreateDeck}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-sm text-sm"
                >
                    <PlusCircle size={18} /> Novo Tópico
                </button>
            </div>
          </div>

          {/* Folders Grid (Only in Root) */}
          {currentFolderId === null && folders.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {folders.map(folder => (
                    <div 
                        key={folder.id}
                        onClick={() => onEnterFolder(folder.id)}
                        className="group bg-blue-50/50 p-4 rounded-xl border border-blue-100 hover:border-brand-400 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <FolderIcon className="text-brand-400 fill-brand-100 group-hover:text-brand-500" size={28} />
                            <span className="font-semibold text-slate-700 group-hover:text-brand-700 truncate">{folder.name}</span>
                        </div>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if(window.confirm(`Excluir pasta "${folder.name}"? Os decks dentro dela serão movidos para o Início.`)) {
                                    onDeleteFolder(folder.id);
                                }
                            }}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-100 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
          )}

          {/* Decks Grid */}
          {visibleDecks.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border-dashed border-2 border-slate-200">
              {currentFolderId ? (
                   <FolderIcon className="mx-auto text-slate-300 mb-2" size={48} />
              ) : (
                   <BookOpen className="mx-auto text-slate-300 mb-2" size={48} />
              )}
              <p className="text-slate-500">Esta pasta está vazia.</p>
              <p className="text-sm text-slate-400">Crie um novo tópico ou mova um existente para cá.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleDecks.map(deck => (
                <div 
                  key={deck.id} 
                  className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between h-full"
                >
                  <div>
                    {/* Decorative Icon */}
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                        <BookOpen size={64} className="text-brand-600" />
                    </div>
                    
                    {/* Action Buttons (Delete & Move & Edit) */}
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button
                            onClick={(e) => { e.stopPropagation(); setMovingDeckId(deck.id); }}
                            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full"
                            title="Mover para pasta"
                        >
                            <FolderInput size={18} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onEditDeck(deck.id); }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                            title="Editar Tópico"
                        >
                            <Pencil size={18} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if(window.confirm(`Tem certeza que deseja excluir "${deck.title}" e todo o seu progresso?`)) {
                                    onDeleteDeck(deck.id);
                                }
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                            title="Excluir Tópico"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>

                    <h3 className="font-bold text-lg text-slate-800 mb-1 pr-16 truncate">{deck.title}</h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2 min-h-[40px]">{deck.description || 'Sem descrição.'}</p>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-end mb-4">
                        <div className="w-full mr-4">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Progresso</span>
                        <div className="flex items-center gap-2">
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-brand-500 rounded-full" 
                                style={{ width: `${deck.masteryLevel}%` }}
                            />
                            </div>
                            <span className="text-xs font-medium text-slate-600">{deck.masteryLevel}%</span>
                        </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                         <button 
                            onClick={() => onViewGuide(deck.id)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                            title="Ler Material de Estudo"
                         >
                            <FileText size={16} /> Resumo
                         </button>
                         <button 
                            onClick={() => onSelectDeck(deck.id)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
                         >
                            <Play size={16} fill="currentColor" /> Estudar
                         </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Analytics Chart (Only visible in Root or if wanted globally) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-fit">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Ritmo de Estudo</h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={studyLogs}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  tick={{fontSize: 12, fill: '#94a3b8'}} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {studyLogs.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#0ea5e9' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 text-center mt-2">Cartas revisadas nos últimos 7 dias</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;