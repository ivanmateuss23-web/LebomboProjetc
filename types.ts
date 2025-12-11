
export enum Difficulty {
  BASIC = 'Básico',
  INTERMEDIATE = 'Intermediário',
  ADVANCED = 'Avançado'
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'Múltipla Escolha',
  CONCEPT_CARD = 'Cartão de Conceito',
  TRUE_FALSE = 'Verdadeiro ou Falso',
  MATCHING = 'Associação'
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface SM2State {
  interval: number; // Days until next review
  repetition: number; // Consecutive successful reviews
  efactor: number; // Easiness factor (min 1.3, default 2.5)
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Card {
  id: string;
  deckId: string;
  front: string; // Question or Concept Name
  back: string; // Answer or Definition
  explanation?: string; // AI generated explanation
  type: QuestionType;
  difficulty: Difficulty;
  options?: string[]; // For multiple choice
  matchingPairs?: { left: string; right: string }[]; // For Matching type
  
  // SRS State
  sm2: SM2State;
  nextReviewDate: number; // Timestamp
  lastReviewDate?: number; // Timestamp
}

export interface Deck {
  id: string;
  folderId?: string | null; // Optional folder association
  title: string;
  description: string;
  totalCards: number;
  masteryLevel: number; // 0-100
  createdAt: number;
  studyGuide?: string; // HTML content for the study guide/summary
}

export interface StudySessionLog {
  date: number;
  cardsReviewed: number;
  averageAccuracy: number; // 0-1
}

export interface UserStats {
  streak: number;
  lastStudyDate: number | null;
  totalXp: number;
  cardsMastered: number;
}

// SM-2 Rating Input (0-5)
// 0-2: Fail (Forgot)
// 3: Hard (Recalled with effort)
// 4: Good (Recalled with hesitation)
// 5: Easy (Perfect recall)
export type Rating = 0 | 1 | 2 | 3 | 4 | 5;
