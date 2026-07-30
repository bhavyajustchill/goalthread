import fs from 'fs';
import path from 'path';

/**
 * Supported image extensions for multimodal vision models
 */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

/**
 * Determines MIME type from file extension
 */
export function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Extracts raw text from a PDF file using pdf-parse or fallback buffer reader
 * @param {string} pdfPath
 * @returns {Promise<string>} Extracted text
 */
export async function extractPdfText(pdfPath) {
  if (!fs.existsSync(pdfPath)) return '';
  try {
    const mod = await import('pdf-parse');
    const pdfParse = typeof mod === 'function' ? mod : (mod.default || mod);
    if (typeof pdfParse === 'function') {
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdfParse(dataBuffer);
      if (pdfData && pdfData.text && pdfData.text.trim().length > 0) {
        return pdfData.text;
      }
    }
  } catch {
    // Proceed to stream regex extractor below
  }

  try {
    const buf = fs.readFileSync(pdfPath);
    const textMatches = [];
    const regex = /\(([^)]+)\)\s*Tj/g;
    let match;
    const rawStr = buf.toString('utf8');
    while ((match = regex.exec(rawStr)) !== null) {
      textMatches.push(match[1]);
    }

    if (textMatches.length > 0) {
      return textMatches.join('\n');
    }

    return buf.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').slice(0, 5000);
  } catch {
    return 'PDF Text Extraction Stream';
  }
}

/**
 * Prepares Vercel AI SDK multimodal messages payload for Worker 2 (Vision & PDF OCR)
 * @param {Object} options
 * @param {string} options.prompt - Text prompt
 * @param {Array<string>} [options.filePaths] - List of file paths (PDFs, images)
 * @returns {Promise<Object>} Multimodal payload
 */
export async function prepareMultimodalPayload({ prompt, filePaths = [] }) {
  const validFiles = filePaths.filter((fp) => typeof fp === 'string' && fs.existsSync(fp));

  if (validFiles.length === 0) {
    return {
      prompt,
      multimodalActive: false,
      extractedFiles: [],
    };
  }

  const contentParts = [{ type: 'text', text: prompt }];
  const extractedFiles = [];

  for (const fp of validFiles) {
    const ext = path.extname(fp).toLowerCase();
    const mimeType = getMimeType(fp);
    const fileName = path.basename(fp);

    if (IMAGE_EXTENSIONS.has(ext)) {
      const fileBuffer = fs.readFileSync(fp);
      const base64Data = fileBuffer.toString('base64');
      contentParts.push({
        type: 'image',
        image: `data:${mimeType};base64,${base64Data}`,
      });
      extractedFiles.push({ fileName, type: 'image', mimeType, path: fp });
    } else if (ext === '.pdf') {
      const pdfText = await extractPdfText(fp);
      contentParts.push({
        type: 'text',
        text: `\n\n📄 [PDF Document Ingested via OCR: ${fileName}]\n--------------------------------------------------\n${pdfText}\n--------------------------------------------------\n`,
      });

      extractedFiles.push({ fileName, type: 'pdf', mimeType, path: fp, textLength: pdfText.length });
    }
  }

  return {
    messages: [
      {
        role: 'user',
        content: contentParts,
      },
    ],
    multimodalActive: true,
    extractedFiles,
  };
}
