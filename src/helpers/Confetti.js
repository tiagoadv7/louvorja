// Confete do Sorteio (Números, Nomes e Roleta) — mesmo efeito do Preline
// (https://preline.co/docs/components/confetti.html), que usa a biblioteca
// canvas-confetti. O <canvas> é criado DENTRO do container passado, então o
// confete fica preso à tela do sorteio (prévia do operador ou projeção) em
// vez de cobrir a janela inteira do app.
import confettiLib from "canvas-confetti";

const COLORS = ["#FF6B6B", "#4ECDC4", "#5B9BD5", "#FDCB6E", "#A29BFE", "#FD79A8", "#0984E3", "#F8C800"];

const instances = new WeakMap();

function getInstance(container) {
  let inst = instances.get(container);
  if (inst && inst.canvas.isConnected) return inst.fire;
  const canvas = document.createElement("canvas");
  canvas.className = "lja-confetti-canvas";
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "6",
  });
  container.appendChild(canvas);
  const fire = confettiLib.create(canvas, { resize: true, useWorker: false });
  instances.set(container, { canvas, fire });
  return fire;
}

export default {
  // Explosão no centro + dois "canhões" laterais
  burst(container) {
    if (!container) return;
    let fire;
    try {
      fire = getInstance(container);
    } catch (_) {
      return;
    }
    const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 6 };
    fire({ ...base, particleCount: 120, spread: 80, startVelocity: 45, origin: { x: 0.5, y: 0.6 } });
    setTimeout(() => {
      fire({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } });
      fire({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } });
    }, 180);
  },

  // Remove o canvas (componente desmontado)
  clear(container) {
    const inst = container && instances.get(container);
    if (!inst) return;
    try { inst.fire.reset(); } catch (_) { /* */ }
    inst.canvas.remove();
    instances.delete(container);
  },
};
