/**
 * promptParser.js
 * Interpreta el prompt en lenguaje natural del usuario y lo convierte en
 * directivas de edición para el pipeline FFmpeg.
 *
 * Punto de extensión: aquí se puede enchufar un LLM (OpenAI/Anthropic/etc.)
 * para interpretación semántica avanzada. La versión incluida es un parser
 * por palabras clave, determinista y sin dependencias externas.
 */

/**
 * @param {string} prompt - texto libre del usuario
 * @returns {object} directivas { removeSilence, captions, dynamic, transitions, bgm }
 */
export function parsePrompt(prompt = "") {
  const p = prompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const has = (...words) => words.some((w) => p.includes(w));

  return {
    // "corta los silencios", "quita los silencios", "sin pausas"
    removeSilence: has("silencio", "silencios", "pausa", "pausas", "corta los"),

    // "subtitulos", "subtítulos llamativos", "texto en pantalla"
    captions: has("subtitulo", "subtitulos", "texto en pantalla", "letras"),

    // "dinamico", "ritmo rapido", "energetico", "viral"
    dynamic: has("dinamico", "ritmo", "rapido", "energia", "energetico", "viral", "epico"),

    // "transiciones", "transiciones rapidas", "efectos"
    transitions: has("transicion", "transiciones", "efecto", "efectos", "zoom"),

    // "musica de fondo", "musica"
    bgm: has("musica", "musica de fondo", "cancion"),

    // Texto crudo por si un LLM externo quiere refinar
    raw: prompt,
  };
}

/**
 * Hook opcional para un LLM externo. Si LLM_API_URL está configurado,
 * se usa para refinar las directivas; si no, se devuelve el parse local.
 */
export async function parsePromptSmart(prompt) {
  const url = process.env.LLM_API_URL;
  if (!url) return parsePrompt(prompt);
  // TODO: POST { prompt } al endpoint del LLM y mapear la respuesta
  // al mismo objeto de directivas. Por ahora, fallback local.
  return parsePrompt(prompt);
}
