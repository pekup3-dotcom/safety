/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

/**
 * Dynamically loads PDF.js from cdnjs, converts the first page of
 * the uploaded PDF file to a high-quality JPEG DataURL (Base64),
 * and returns it. This allows drawing coordinates on top of it.
 */
export async function convertPdfToImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if pdfjs is already loaded
    if (window.pdfjsLib) {
      renderPdf(file, resolve, reject);
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        renderPdf(file, resolve, reject);
      };
      script.onerror = () => {
        reject(new Error('PDF.js CDN 라이브러리를 로드하지 못했습니다. 네트워크 상태를 확인하여 주십시오.'));
      };
      document.head.appendChild(script);
    }
  });
}

function renderPdf(file: File, resolve: (val: string) => void, reject: (err: Error) => void) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const arrayBuffer = e.target?.result as ArrayBuffer;
    if (!arrayBuffer) {
      reject(new Error('PDF 파일을 읽을 수 없습니다.'));
      return;
    }

    try {
      const pdfjsLib = window.pdfjsLib;
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      if (pdf.numPages === 0) {
        reject(new Error('PDF 문서에 페이지가 존재하지 않습니다.'));
        return;
      }

      // Convert page 1
      const page = await pdf.getPage(1);
      
      // Scale 2.0 to offer sharp blueprint layouts
      const viewport = page.getViewport({ scale: 2.0 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas 2D context 생성에 실패하였습니다.'));
        return;
      }
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Output as optimized Quality 0.8 JPEG base64 to minimize Firestore storage space
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
      resolve(imageBase64);
    } catch (err: any) {
      console.error("PDF to image conversion error:", err);
      reject(new Error(`PDF 도면 렌더링에 실패하였습니다: ${err.message || err}`));
    }
  };
  reader.onerror = () => reject(new Error('PDF 로컬 파일 리더 실패'));
  reader.readAsArrayBuffer(file);
}
