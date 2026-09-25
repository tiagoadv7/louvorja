import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import $electron from "@/helpers/Electron";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// "new Worker(url, {type:'module'})" trava o bootstrap interno do renderer
// sandboxado do Electron ("TypeError: object is not iterable", vindo de
// dentro do próprio Electron — reproduzido isolado, sem pdf.js nenhum, e
// mesmo com webPreferences.sandbox:false na janela). O pdf.js já tem um
// fallback pronto pra quando o Worker "de verdade" falha (renderiza na
// thread principal, ver PDFWorker#_setupFakeWorker no pacote) — só que ele
// só entra nesse fallback se a CRIAÇÃO do Worker falhar de forma síncrona.
// Como o travamento do Electron acontece de um jeito que o pdf.js não
// consegue capturar sozinho, força aqui: qualquer Worker do tipo "module"
// falha na hora, então o próprio try/catch do pdf.js já cai no fallback
// certo — sem precisar abrir mão do sandbox do Electron pra isso. Nenhuma
// outra parte do app usa Worker de módulo, então isso não afeta mais nada.
if (typeof window !== "undefined" && window.Worker) {
  const RealWorker = window.Worker;
  window.Worker = function PatchedWorker(scriptURL, options) {
    if (options?.type === "module") {
      throw new Error("Module Workers desabilitados neste app (ver PdfRenderer.js) — pdf.js cai no fallback de thread principal.");
    }
    return new RealWorker(scriptURL, options);
  };
}

// Renderização de PDF pro Vídeo/Liturgia projetar página a página, igual ao
// FreeShow (pdfjs-dist, uma página por vez, sem converter o arquivo inteiro
// em imagens antes). Cada processo do Electron (painel do operador e janela
// de saída são processos/renderers SEPARADOS) tem seu próprio cache aqui —
// não precisa reabrir/reler o arquivo do disco a cada troca de página,
// só ao trocar de PDF.
let _cache = { path: null, doc: null };

async function loadDoc(path) {
  if (_cache.path === path && _cache.doc) return _cache.doc;
  const raw = await $electron.readFile(path, null);
  if (!raw) throw new Error(`Não foi possível ler o arquivo: ${path}`);
  const loadingTask = getDocument({ data: new Uint8Array(raw) });
  const doc = await loadingTask.promise;
  _cache = { path, doc };
  return doc;
}

export default {
  // Descobre quantas páginas o PDF tem (usado ao abrir o arquivo pela
  // primeira vez, pra já mostrar "1 / N" e habilitar/desabilitar os botões
  // de próxima/anterior corretamente).
  async getPageCount(path) {
    const doc = await loadDoc(path);
    return doc.numPages;
  },
  // Renderiza a página (1-indexed, sempre limitada a [1, numPages]) no
  // canvas informado. scale alto (padrão 3) porque o canvas é escalado pra
  // caber na tela de projeção/prévia via CSS — renderizar já em baixa
  // resolução deixaria o texto borrado num telão.
  async renderPage(path, pageNumber, canvas, scale = 3) {
    const doc = await loadDoc(path);
    const clampedPage = Math.max(1, Math.min(pageNumber, doc.numPages));
    const page = await doc.getPage(clampedPage);
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return { pageCount: doc.numPages, page: clampedPage };
  },
};
