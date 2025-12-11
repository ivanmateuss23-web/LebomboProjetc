
import { GoogleGenAI, Type } from "@google/genai";
import { Card, Difficulty, QuestionType, Rating } from '../types';

// Simple ID generator
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

export const generateDeckContent = async (
  topic: string,
  level: 'Graduação' | 'Pós-Graduação',
  quantity: number = 40,
  contextText?: string,
  mode: 'topic' | 'file' | 'clinical' = 'topic',
  questionFormat?: 'mixed' | 'multiple_choice' | 'open',
  language: 'pt' | 'es' = 'pt',
  customInstructions?: string
): Promise<Partial<Card>[]> => {
  
  let basePrompt = "";
  let formatInstruction = "";
  
  const langInstruction = language === 'es' 
    ? "IMPORTANTE: Gere TODO o conteúdo (perguntas, respostas, explicações, alternativas) estritamente em ESPANHOL."
    : "IMPORTANTE: Gere TODO o conteúdo estritamente em PORTUGUÊS.";

  if (questionFormat === 'multiple_choice') {
    formatInstruction = "TODAS as perguntas devem ser OBRIGATORIAMENTE de 'Múltipla Escolha' com 5 alternativas.";
  } else if (questionFormat === 'open') {
    formatInstruction = "TODAS as perguntas devem ser OBRIGATORIAMENTE dissertativas ('Cartão de Conceito').";
  } else {
    formatInstruction = `
      DIVERSIFIQUE OS FORMATOS DAS QUESTÕES para testar diferentes habilidades cognitivas.
      Distribuição aproximada:
      - 40% Múltipla Escolha (5 alternativas)
      - 30% Cartão de Conceito (Dissertativa)
      - 15% Verdadeiro ou Falso (Para verificar fatos rápidos)
      - 15% Associação (Parear termos e definições - mínimo 4 pares por questão)
    `;
  }

  if (mode === 'clinical') {
    // Clinical Case Mode
    basePrompt = `
      Você é um Preceptor de Residência Médica/Multiprofissional altamente experiente e didático.
      ${langInstruction}
      
      OBJETIVO: Criar um banco de ${quantity} questões baseadas EXCLUSIVAMENTE em CASOS CLÍNICOS REAIS/SIMULADOS sobre o tema: "${topic}".
      Nível de complexidade: "${level}".
      ${formatInstruction}

      ESTRUTURA OBRIGATÓRIA PARA CADA CARD:
      1. Front (Pergunta): DEVE apresentar um CASO CLÍNICO. Inclua:
         - Perfil do paciente (Idade, gênero).
         - Queixa principal e História da Moléstia Atual (HMA).
         - Dados vitais e Exame Físico pertinentes.
         - Encerre com a PERGUNTA CLÍNICA.
      
      2. Back (Resposta): A resposta objetiva e direta.
      
      3. Explanation (Discussão): Discussão detalhada do caso. Explique por que a resposta está correta e por que diagnósticos diferenciais foram descartados.

      DIVERSIFICAÇÃO:
      - Varie os cenários: Emergência, Ambulatório, UTI, Pós-operatório.
      - Varie o foco: Diagnóstico, Tratamento Farmacológico, Intervenção, Fisiopatologia.
    `;
  } else if (contextText) {
    // Generate based on provided text
    // Increased context limit significantly for Gemini Flash (supports ~1M tokens)
    basePrompt = `
      Você é um professor universitário rigoroso. Crie um exame abrangente com EXATAMENTE ${quantity} perguntas baseadas EXCLUSIVAMENTE no texto de referência abaixo.
      ${langInstruction}
      ${formatInstruction}

      TEXTO DE REFERÊNCIA (Conteúdo Comprimido):
      """
      ${contextText.substring(0, 1000000)} 
      """
      
      OBJETIVO: Cobrir TODO o conteúdo do texto fornecido, com FOCO ESPECIAL EM DEFINIÇÕES E TERMOS TÉCNICOS IMPORTANTES.
      1. Identifique os conceitos-chave, termos técnicos e definições fundamentais no texto.
      2. Crie perguntas que exijam o domínio desses termos.
      3. Divida o texto mentalmente em seções lógicas para garantir cobertura completa.
    `;
  } else {
    // Generate based on global knowledge (Standard Topic)
    basePrompt = `
      Você é um coordenador de curso universitário planejando um EXAME FINAL DE DOMÍNIO COMPLETO.
      ${langInstruction}
      
      Tópico: "${topic}"
      Nível: "${level}"
      Quantidade de Questões: ${quantity}
      ${formatInstruction}
      
      ESTRATÉGIA DE ABRANGÊNCIA TOTAL COM FOCO EM DEFINIÇÕES:
      1. Mapeie os TERMOS TÉCNICOS, CONCEITOS e DEFINIÇÕES mais importantes deste assunto.
      2. Priorize perguntas que solidifiquem o vocabulário técnico e o entendimento conceitual.
      3. Distribua as perguntas:
         - 40% Definições e Conceitos Fundamentais.
         - 30% Aplicação Prática e Exemplos.
         - 30% Análise e Comparação (Avançado).
      
      Não deixe lacunas teóricas. O aluno deve sair deste questionário dominando a terminologia do assunto.
    `;
  }

  // Inject custom instructions if provided
  if (customInstructions && customInstructions.trim()) {
      basePrompt += `\n\nINSTRUÇÕES ADICIONAIS IMPORTANTES:\n${customInstructions}\n`;
  }

  const prompt = `
    ${basePrompt}
    
    Retorne APENAS um JSON array válido contendo os objetos das perguntas.
    Não use markdown code blocks (\`\`\`json), apenas o raw JSON.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: {
                type: Type.STRING,
                description: mode === 'clinical' ? "O caso clínico completo + a pergunta." : "A pergunta, afirmação ou instrução.",
              },
              back: {
                type: Type.STRING,
                description: "A resposta correta. Para 'Verdadeiro ou Falso', use apenas 'Verdadeiro' ou 'Falso'. Para 'Associação', deixe vazio ou faça um resumo.",
              },
              explanation: {
                type: Type.STRING,
                description: "Explicação detalhada do conceito.",
              },
              difficulty: {
                type: Type.STRING,
                enum: ["Básico", "Intermediário", "Avançado"]
              },
              type: {
                type: Type.STRING,
                enum: ["Cartão de Conceito", "Múltipla Escolha", "Verdadeiro ou Falso", "Associação"]
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Obrigatório para 'Múltipla Escolha'. Inclua 5 opções.",
              },
              matchingPairs: {
                type: Type.ARRAY,
                items: {
                   type: Type.OBJECT,
                   properties: {
                       left: { type: Type.STRING, description: "Termo ou Conceito" },
                       right: { type: Type.STRING, description: "Definição ou Associação" }
                   }
                },
                description: "Obrigatório para 'Associação'. Inclua entre 4 e 6 pares."
              }
            },
            required: ["front", "back", "difficulty", "explanation", "type"],
          },
        },
      },
    });

    const rawData = JSON.parse(response.text || "[]");
    
    return rawData.map((item: any) => {
      // Normalize Type
      let type = QuestionType.CONCEPT_CARD;
      const rawType = (item.type || "").toLowerCase();
      
      if (rawType.includes('múltipla') || rawType.includes('multipla') || rawType.includes('multiple')) type = QuestionType.MULTIPLE_CHOICE;
      else if (rawType.includes('verdadeiro') || rawType.includes('true')) type = QuestionType.TRUE_FALSE;
      else if (rawType.includes('associação') || rawType.includes('matching') || rawType.includes('parear')) type = QuestionType.MATCHING;

      return {
        id: generateId(),
        front: item.front,
        back: item.back,
        explanation: item.explanation,
        difficulty: item.difficulty as Difficulty,
        type: type,
        options: item.options || [],
        matchingPairs: item.matchingPairs || [],
        sm2: { interval: 0, repetition: 0, efactor: 2.5 },
        nextReviewDate: Date.now(),
      };
    });

  } catch (error) {
    console.error("Error generating cards:", error);
    throw new Error("Falha ao gerar perguntas.");
  }
};

export const generateStudyGuide = async (
  topic: string,
  level: string,
  contextText?: string,
  mode: 'topic' | 'file' | 'clinical' = 'topic',
  language: 'pt' | 'es' = 'pt'
): Promise<string> => {
  let prompt = "";
  
  const langInstruction = language === 'es' 
    ? "Escreva o texto em ESPANHOL."
    : "Escreva o texto em PORTUGUÊS.";

  const tableInstruction = language === 'es'
    ? "Incluya obligatoriamente una TABLA COMPARATIVA (usando etiquetas HTML <table>, <tr>, <th>, <td>) que contraste los conceptos principales, tratamientos o diagnósticos diferenciales del tema."
    : "Inclua OBRIGATORIAMENTE uma TABELA COMPARATIVA (usando tags HTML <table>, <tr>, <th>, <td>) contrastando os principais conceitos, tratamentos ou diagnósticos diferenciais do tema.";

  if (mode === 'clinical') {
    prompt = `
      Crie um RESUMO CLÍNICO ESTRUTURADO (Study Guide) completo sobre "${topic}" para nível ${level}.
      ${langInstruction}
      Use HTML simples (h1, h2, h3, p, ul, li, strong) para formatar. Não use markdown.
      ${tableInstruction}
      
      Estrutura Obrigatória:
      1. Definição e Epidemiologia
      2. Fisiopatologia (explicada de forma clara)
      3. Quadro Clínico (Sinais e Sintomas)
      4. Diagnóstico (Exames, critérios)
      5. TABELA COMPARATIVA (Diagnóstico Diferencial ou Classificação)
      6. Tratamento e Manejo
      7. Pontos de Atenção (Red Flags)
    `;
  } else if (contextText) {
    prompt = `
      Crie um RESUMO DETALHADO do texto fornecido abaixo, estruturado como um guia de estudos para nível ${level}.
      ${langInstruction}
      Use HTML simples (h1, h2, h3, p, ul, li, strong) para formatar. Não use markdown.
      ${tableInstruction}
      
      Texto (Resumo):
      """
      ${contextText.substring(0, 1000000)}
      """
      
      Foque em extrair: conceitos chave, definições, relações de causa e efeito e conclusões principais.
      Certifique-se de criar a tabela comparativa baseada nos dados do texto.
    `;
  } else {
    prompt = `
      Crie um GUIA DE ESTUDOS COMPLETO (Apostila Resumida) sobre "${topic}" para nível ${level}.
      ${langInstruction}
      Use HTML simples (h1, h2, h3, p, ul, li, strong) para formatar. Não use markdown.
      ${tableInstruction}
      
      O guia deve cobrir todo o escopo do assunto, dividido em capítulos ou seções lógicas.
      Seja didático, use bullet points para listas e negrito para termos importantes (Definições).
    `;
  }

  try {
    const response = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text || "<p>Não foi possível gerar o resumo.</p>";
  } catch (e) {
    console.error(e);
    return "<p>Erro ao gerar material de estudo.</p>";
  }
};

export interface AIFeedback {
  score: Rating;
  feedback: string;
  isCorrect: boolean;
}

export const evaluateAnswer = async (
  question: string, 
  correctAnswer: string, 
  userAnswer: string
): Promise<AIFeedback> => {
  if (!userAnswer.trim()) {
    return { score: 0, feedback: "Nenhuma resposta fornecida.", isCorrect: false };
  }

  try {
    const prompt = `
      Atue como um corretor rigoroso de provas universitárias.
      
      Pergunta/Caso: "${question}"
      Gabarito Oficial: "${correctAnswer}"
      Resposta do Aluno: "${userAnswer}"
      
      Avalie a resposta do aluno comparando com o gabarito.
      1. Atribua uma nota de 0 a 5 (onde 0 é errado/branco, 3 é regular, 5 é perfeito).
      2. Forneça um feedback curto (máx 2 frases) explicando o erro ou elogiando o acerto.
      3. Determine boolean isCorrect (true se nota >= 3).
    `;

    const response = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER, description: "Nota de 0 a 5" },
            feedback: { type: Type.STRING, description: "Feedback curto para o aluno" },
            isCorrect: { type: Type.BOOLEAN }
          },
          required: ["score", "feedback", "isCorrect"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    // Safety clamp for rating
    let rating = result.score;
    if (rating < 0) rating = 0;
    if (rating > 5) rating = 5;

    return {
      score: rating as Rating,
      feedback: result.feedback,
      isCorrect: result.isCorrect
    };

  } catch (error) {
    console.error("Evaluation error", error);
    // Fallback if AI fails
    return { score: 0, feedback: "Erro ao avaliar resposta. Tente auto-avaliação.", isCorrect: false };
  }
};
