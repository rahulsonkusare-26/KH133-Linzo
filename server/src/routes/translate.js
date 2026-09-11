import { Router } from 'express';

const router = Router();

function parseEndpointList() {
  const env = process.env.LIBRETRANSLATE_URLS || process.env.LIBRETRANSLATE_URL || '';
  const list = env
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  // sensible defaults: local first, then public hosted
  if (list.length === 0) {
    // Prefer public endpoint by default so it works without local install
    list.push('https://libretranslate.com');
    list.push('http://127.0.0.1:5001');
  }
  return list;
}

function normalizeLanguageCode(language, fallback = 'auto') {
  const value = String(language || fallback).trim().toLowerCase();
  if (!value) return fallback;
  if (value === 'auto') return 'auto';
  return value.split('-')[0];
}

function isBadTranslatedText(text) {
  if (!text || typeof text !== 'string') return true;
  const normalized = text.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized.includes('invalid source language') ||
    normalized.includes('invalid target language') ||
    normalized.includes('translated.net') && normalized.includes('error')
  );
}

function requireTranslatedText(data, provider) {
  const translatedText = data?.translatedText?.trim();
  if (isBadTranslatedText(translatedText)) {
    throw new Error(`${provider} returned an invalid translation`);
  }
  return { ...data, translatedText };
}

function buildTranslationPrompt(q, source, target) {
  const sourceLabel = source === 'auto' ? 'the detected source language' : source;
  return [
    `Translate the following text from ${sourceLabel} to ${target}.`,
    'Return only the translated text. Do not add explanations, quotes, labels, or error messages.',
    `Text: ${q}`
  ].join('\n');
}

function extractGeminiTranslatedText(data) {
  const directText = (
    data?.output_text ||
    data?.output?.text ||
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    ''
  ).trim();
  if (directText) return directText;

  const modelOutput = Array.isArray(data?.steps)
    ? data.steps.find(step => step?.type === 'model_output')
    : null;

  if (Array.isArray(modelOutput?.content)) {
    return modelOutput.content
      .map(part => typeof part?.text === 'string' ? part.text : '')
      .filter(Boolean)
      .join('')
      .trim();
  }

  return '';
}

function containsDevanagari(text) {
  return /[\u0900-\u097F]/.test(text || '');
}

function isLowQualityMyMemoryText(text, source, target, originalText) {
  const normalized = String(text || '').trim();
  if (isBadTranslatedText(normalized)) return true;

  // For Hindi output, Romanized text is worse than returning the original.
  if (target === 'hi' && !containsDevanagari(normalized)) return true;

  // Detect echo: MyMemory returned the input (or its transliteration) unchanged.
  // e.g. input "aaj ki meeting start Karte Hain" → output "aaj ki meeting start Karte Hain"
  if (originalText && normalized.toLowerCase() === String(originalText).trim().toLowerCase()) {
    return true;
  }

  // MyMemory often mistranslates short Hindi utterances into unrelated English.
  // Let Gemini/Google handle these; if they fail, keep the original instead.
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (source === 'hi' && target === 'en' && wordCount <= 4) return true;

  return false;
}


// Gemini API translation function
async function tryGeminiTranslate(payload, timeoutMs = 10000) {
  const { q, source, target } = payload;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const prompt = buildTranslationPrompt(q, source, target);

  // Standard Gemini REST API payload (generateContent)
  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1000
    }
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

  console.log(`🧪 [Gemini] Translating "${q}" (${source} -> ${target}) via ${model}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const rawText = await response.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (parseError) {
      console.warn('🧪 [Gemini] Failed to parse JSON response:', parseError.message);
    }

    if (!response.ok) {
      const message = data?.error?.message || `Gemini API error: ${response.status}`;
      console.warn(`🧪 [Gemini] API error ${response.status}: ${message}`);
      throw new Error(message);
    }

    const translatedText = extractGeminiTranslatedText(data);

    console.log(`🧪 [Gemini] Result: "${translatedText}"`);

    return requireTranslatedText({ translatedText }, 'Gemini');
  } catch (error) {
    clearTimeout(timer);
    console.warn(`🧪 [Gemini] Error: ${error.message}`);
    throw error;
  }
}

async function tryTranslate(endpoints, payload, timeoutMs = 4000) {
  let lastErr;
  for (const base of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const r = await fetch(`${base.replace(/\/$/, '')}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, format: 'text' }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        lastErr = new Error(data?.error || `Upstream ${base} status ${r.status}`);
        continue;
      }
      return requireTranslatedText(data, 'LibreTranslate');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All translation endpoints failed');
}

async function tryMyMemory(payload, timeoutMs = 4000) {
  const { q, source, target } = payload;
  if (source === 'auto') {
    throw new Error('MyMemory does not support auto source language');
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(source)}|${encodeURIComponent(target)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const r = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);
  const data = await r.json().catch(() => ({}));
  const text = data?.responseData?.translatedText;
  const status = Number(data?.responseStatus || r.status);
  if (!r.ok || status >= 400) {
    throw new Error(data?.responseDetails || 'MyMemory failed');
  }
  if (isLowQualityMyMemoryText(text, source, target, q)) {
    throw new Error('MyMemory returned a low-quality translation');
  }
  return requireTranslatedText({ translatedText: text }, 'MyMemory');
}

async function tryGoogleTranslate(payload, timeoutMs = 4000) {
  const { q, source, target } = payload;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(q)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const r = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data || !data[0]) throw new Error('Google Translate failed');
  const translatedText = data[0].map(item => item[0]).join('');
  return requireTranslatedText({ translatedText }, 'Google Translate');
}

// POST /api/translate { q, source, target }
router.post('/', async (req, res) => {
  try {
    const { q, source, target } = req.body || {};
    if (!q || !source || !target) {
      return res.status(400).json({ message: 'Missing q, source, or target' });
    }

    const normalizedSource = normalizeLanguageCode(source, 'auto');
    const normalizedTarget = normalizeLanguageCode(target, 'en');

    console.log(`[Translate] "${q}" ${normalizedSource} -> ${normalizedTarget}`);

    if (normalizedSource !== 'auto' && normalizedSource === normalizedTarget) {
      return res.json({ translatedText: q, method: 'same-language' });
    }

    const endpoints = parseEndpointList();
    let data;
    let translationMethod = 'unknown';

    try {
      // Try Gemini API first (if API key is available)
      try {
        data = await tryGeminiTranslate({ q, source: normalizedSource, target: normalizedTarget });
        translationMethod = 'gemini';
        console.log(`✅ Gemini translation successful: "${data.translatedText}"`);
      } catch (geminiError) {
        console.log(`⚠️ Gemini translation failed: ${geminiError.message}`);
        throw geminiError; // This will trigger the next fallback
      }
    } catch (e) {
      // Fallback to LibreTranslate
      try {
        data = await tryTranslate(endpoints, { q, source: normalizedSource, target: normalizedTarget });
        translationMethod = 'libretranslate';
        console.log(`✅ LibreTranslate translation successful: "${data.translatedText}"`);
      } catch (e2) {
        // Fallback to Google Translate (free, unofficial endpoint)
        try {
          data = await tryGoogleTranslate({ q, source: normalizedSource, target: normalizedTarget });
          translationMethod = 'google';
          console.log(`✅ Google Translate translation successful: "${data.translatedText}"`);
        } catch (e3) {
          // Final fallback to MyMemory
          try {
            data = await tryMyMemory({ q, source: normalizedSource, target: normalizedTarget });
            translationMethod = 'mymemory';
            console.log(`✅ MyMemory translation successful: "${data.translatedText}"`);
          } catch (e4) {
            console.error(`❌ All translation methods failed:`, { gemini: e.message, libretranslate: e2.message, google: e3.message, mymemory: e4.message });
            return res.status(502).json({
              message: 'Translation failed',
              details: `All methods failed. Last error: ${e4.message}`,
              methods: ['gemini', 'libretranslate', 'google', 'mymemory']
            });
          }
        }
      }
    }

    console.log(`🎯 Translation completed using ${translationMethod}: "${q}" -> "${data.translatedText}"`);
    return res.json({ ...data, method: translationMethod });
  } catch (err) {
    console.error('Translate proxy error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/translate/smart-replies { context, summary, targetLang }
router.post('/smart-replies', async (req, res) => {
  try {
    const { context, summary, targetLang } = req.body || {};

    if (!context || !targetLang) {
      return res.status(400).json({ message: 'Missing context or targetLang' });
    }

    console.log(`🤖 Smart reply request for language: ${targetLang}`);

    // Check if Hugging Face API key is available
    const hfApiKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfApiKey) {
      console.warn('⚠️ Hugging Face API key not configured, returning fallback replies');
      return res.json({
        replies: [
          "I understand.",
          "That makes sense.",
          "Let me think about it."
        ],
        method: 'fallback'
      });
    }

    // Build context from recent messages
    const recentMessages = context.slice(-8); // Last 8 messages for context
    const contextText = recentMessages
      .map(msg => `${msg.speaker}: ${msg.text}`)
      .join('\n');

    const summaryText = summary || 'No summary available yet.';

    // Create prompt for smart reply generation
    const prompt = `Based on this conversation context and summary, generate exactly 3 short, natural, context-aware reply suggestions (each 3-8 words). Return ONLY the 3 suggestions, one per line, no numbering.

Conversation:
${contextText}

Summary:
${summaryText}

Generate 3 concise reply suggestions:`;

    console.log(`🤖 Generating smart replies with prompt length: ${prompt.length}`);

    // Call Hugging Face API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hfApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 100,
              temperature: 0.7,
              top_p: 0.9,
              do_sample: true,
              return_full_text: false
            }
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`🤖 HuggingFace response:`, data);

      // Parse the generated text
      let generatedText = '';
      if (Array.isArray(data) && data[0]?.generated_text) {
        generatedText = data[0].generated_text;
      } else if (data?.generated_text) {
        generatedText = data.generated_text;
      } else {
        throw new Error('Unexpected response format from HuggingFace');
      }

      // Extract the 3 suggestions from generated text
      const lines = generatedText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'))
        .map(line => line.replace(/^[\d\-\*\.]+\s*/, '').trim()) // Remove numbering/bullets
        .filter(line => line.length > 0 && line.length < 100); // Filter reasonable lengths

      let suggestions = lines.slice(0, 3);

      // Fallback if we don't get 3 suggestions
      if (suggestions.length < 3) {
        suggestions = [
          "I agree with that.",
          "Could you elaborate?",
          "That's a good point."
        ].slice(0, 3 - suggestions.length).concat(suggestions);
        suggestions = suggestions.slice(0, 3);
      }

      console.log(`🤖 Generated suggestions in English:`, suggestions);

      // Translate suggestions to target language if not English
      const targetLangCode = targetLang.split('-')[0].toLowerCase();
      if (targetLangCode !== 'en') {
        console.log(`🤖 Translating suggestions to ${targetLang}...`);
        const translatedSuggestions = await Promise.all(
          suggestions.map(async (suggestion) => {
            try {
              // Try Gemini first, then fallback to other methods
              try {
                const result = await tryGeminiTranslate({ q: suggestion, source: 'en', target: targetLangCode });
                return result.translatedText;
              } catch {
                try {
                  const endpoints = parseEndpointList();
                  const result = await tryTranslate(endpoints, { q: suggestion, source: 'en', target: targetLangCode });
                  return result.translatedText;
                } catch {
                  try {
                    const result = await tryGoogleTranslate({ q: suggestion, source: 'en', target: targetLangCode });
                    return result.translatedText;
                  } catch {
                    const result = await tryMyMemory({ q: suggestion, source: 'en', target: targetLangCode });
                    return result.translatedText;
                  }
                }
              }
            } catch (error) {
              console.warn(`⚠️ Translation failed for suggestion "${suggestion}":`, error.message);
              return suggestion; // Return English if translation fails
            }
          })
        );

        console.log(`🤖 Translated suggestions:`, translatedSuggestions);
        return res.json({ replies: translatedSuggestions, method: 'huggingface' });
      }

      return res.json({ replies: suggestions, method: 'huggingface' });

    } catch (fetchError) {
      clearTimeout(timeout);
      console.error(`❌ HuggingFace API call failed:`, fetchError.message);

      // Fallback to generic suggestions
      const fallbackSuggestions = [
        "I understand.",
        "Please continue.",
        "That makes sense."
      ];

      // Translate fallback suggestions if needed
      const targetLangCode = targetLang.split('-')[0].toLowerCase();
      if (targetLangCode !== 'en') {
        try {
          const translatedFallback = await Promise.all(
            fallbackSuggestions.map(async (suggestion) => {
              try {
                const result = await tryGoogleTranslate({ q: suggestion, source: 'en', target: targetLangCode });
                return result.translatedText;
              } catch {
                return suggestion;
              }
            })
          );
          return res.json({ replies: translatedFallback, method: 'fallback' });
        } catch {
          return res.json({ replies: fallbackSuggestions, method: 'fallback' });
        }
      }

      return res.json({ replies: fallbackSuggestions, method: 'fallback' });
    }

  } catch (err) {
    console.error('Smart reply generation error:', err);
    res.status(500).json({
      message: 'Smart reply generation failed',
      replies: ["Yes", "No", "Maybe"]
    });
  }
});

// GET /api/translate/languages → tries endpoints until one responds
router.get('/languages', async (req, res) => {
  const endpoints = parseEndpointList();
  let lastErr;
  for (const base of endpoints) {
    try {
      const r = await fetch(`${base.replace(/\/$/, '')}/languages`);
      if (!r.ok) continue;
      const data = await r.json();
      return res.json({ endpoint: base, languages: data });
    } catch (e) {
      lastErr = e;
    }
  }
  res.status(502).json({ message: 'Languages unavailable', error: String(lastErr || 'unknown') });
});

// GET /api/translate/test → sanity test en→hi and hi→en
router.get('/test', async (req, res) => {
  try {
    const endpoints = parseEndpointList();
    const en2hi = await (async () => {
      try { return await tryGeminiTranslate({ q: 'hello', source: 'en', target: 'hi' }); }
      catch {
        try { return await tryTranslate(endpoints, { q: 'hello', source: 'en', target: 'hi' }); }
        catch {
          try { return await tryGoogleTranslate({ q: 'hello', source: 'en', target: 'hi' }); }
          catch { return await tryMyMemory({ q: 'hello', source: 'en', target: 'hi' }); }
        }
      }
    })();
    const hi2en = await (async () => {
      try { return await tryGeminiTranslate({ q: 'नमस्ते', source: 'hi', target: 'en' }); }
      catch {
        try { return await tryTranslate(endpoints, { q: 'नमस्ते', source: 'hi', target: 'en' }); }
        catch {
          try { return await tryGoogleTranslate({ q: 'नमस्ते', source: 'hi', target: 'en' }); }
          catch { return await tryMyMemory({ q: 'नमस्ते', source: 'hi', target: 'en' }); }
        }
      }
    })();
    return res.json({ ok: true, en2hi, hi2en });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e) });
  }
});

// GET /api/translate/supported-languages → returns supported language codes
router.get('/supported-languages', async (req, res) => {
  const supportedLanguages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' }
  ];
  return res.json({ languages: supportedLanguages });
});

// GET /api/translate/tts?text=...&lang=...
router.get('/tts', async (req, res) => {
  try {
    const { text, lang } = req.query;
    if (!text || !lang) {
      return res.status(400).send('Missing text or lang');
    }

    const langCode = lang.split('-')[0];
    const encodedText = encodeURIComponent(text);
    // Use the robust Google TTS endpoint
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${langCode}&client=tw-ob`;

    console.log(`🔊 Proxying TTS request: "${text}" (${langCode})`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Google TTS failed: ${response.status}`);
    }

    // Stream the audio back
    res.setHeader('Content-Type', 'audio/mpeg');
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error('❌ TTS Proxy error:', err);
    res.status(500).send('TTS Failed');
  }
});

export default router;
