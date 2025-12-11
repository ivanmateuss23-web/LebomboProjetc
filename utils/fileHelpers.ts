
import mammoth from 'mammoth';
import readXlsxFile from 'read-excel-file';

// Helper to define window type for PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

// Function to "compress" text by removing excessive whitespace
const compressText = (text: string): string => {
    return text.replace(/\s+/g, ' ').trim();
};

export const extractTextFromPdf = async (file: File): Promise<string> => {
  if (!window.pdfjsLib) {
    throw new Error("Biblioteca PDF.js não carregada.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = "";
  
  // Increased limit significantly to handle "Large PDFs". 
  // Gemini 2.5 has a large context window, so we can afford to read more pages.
  const maxPages = Math.min(pdf.numPages, 250); 

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    
    // Add page marker but compress content slightly
    fullText += `\n[P${i}] ${compressText(pageText)}`;
  }

  return fullText;
};

export const extractTextFromDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return compressText(result.value);
};

export const extractTextFromExcel = async (file: File): Promise<string> => {
  // read-excel-file handles the file directly
  try {
    const rows = await readXlsxFile(file);
    // Convert rows (arrays of cells) into a string representation
    return rows.map((row: any[]) => row.join(", ")).join("\n");
  } catch (error) {
    console.error("Excel parse error", error);
    throw new Error("Erro ao ler arquivo Excel. Certifique-se que é um formato válido.");
  }
};

export const processFile = async (file: File): Promise<string> => {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return extractTextFromPdf(file);
  } else if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
    name.endsWith('.docx')
  ) {
    return extractTextFromDocx(file);
  } else if (
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv')
  ) {
    return extractTextFromExcel(file);
  } else if (type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
    // Plain text fallback
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(compressText(e.target?.result as string));
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
  } else {
    throw new Error("Formato de arquivo não suportado.");
  }
};
