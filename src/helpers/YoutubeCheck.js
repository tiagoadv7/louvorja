// Chave da YouTube Data API, vinda do .env (VITE_YOUTUBE_API_KEY). Opcional: com
// ela, o app confere o vídeo antes de tocar e mostra o motivo certo quando o
// YouTube não deixa reproduzir fora do site (a chave não contorna isso no player).
export function getYoutubeApiKey() {
  return (import.meta.env.VITE_YOUTUBE_API_KEY || "").trim();
}

// Resolve { ok, reason }. Sem chave, ou se a consulta falhar, não bloqueia.
export async function checkYoutubeEmbeddable(videoId) {
  const key = getYoutubeApiKey();
  if (!key || !videoId) return { ok: true };
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) return { ok: true };
    const data = await res.json();
    const item = data.items && data.items[0];
    if (!item) return { ok: false, reason: "video_not_found" };
    if (item.status && item.status.embeddable === false) return { ok: false, reason: "not_embeddable" };
    return { ok: true };
  } catch (_) {
    return { ok: true };
  }
}
