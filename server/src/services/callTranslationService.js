import axios from 'axios';

/**
 * Translation service for phone calls using Gemini REST API.
 * Uses GEMINI_API_KEY from .env and falls back to lighter translation providers.
 */
class CallTranslationService {
    constructor() {
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        this.geminiModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
        this.geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/interactions';
        this.cache = new Map();
        this.providerCooldownUntil = new Map();
        this.cacheTtlMs = 10 * 60 * 1000;
        this.defaultCooldownMs = 60 * 1000;
    }

    normalizeLang(language, fallback = 'auto') {
        const value = String(language || fallback).trim().toLowerCase();
        if (!value) return fallback;
        if (value === 'auto') return 'auto';
        return value.split('-')[0];
    }

    normalizeText(text) {
        return String(text || '').trim().replace(/\s+/g, ' ');
    }

    cacheKey(text, source, target) {
        return `${source}|${target}|${this.normalizeText(text).toLowerCase()}`;
    }

    getCached(text, source, target) {
        const key = this.cacheKey(text, source, target);
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() - item.createdAt > this.cacheTtlMs) {
            this.cache.delete(key);
            return null;
        }
        return item.translated;
    }

    setCached(text, source, target, translated) {
        const key = this.cacheKey(text, source, target);
        this.cache.set(key, { translated, createdAt: Date.now() });
    }

    providerAvailable(provider) {
        return Date.now() >= (this.providerCooldownUntil.get(provider) || 0);
    }

    cooldownProvider(provider, err) {
        const retryAfter = Number(err?.response?.headers?.['retry-after']);
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : this.defaultCooldownMs;
        this.providerCooldownUntil.set(provider, Date.now() + waitMs);
        console.warn(`⏳ [${provider}] rate limited; cooling down for ${Math.round(waitMs / 1000)}s`);
    }

    hasInvalidProviderText(text) {
        const normalized = String(text || '').trim().toLowerCase();
        return (
            !normalized ||
            normalized.includes('invalid source language') ||
            normalized.includes('invalid target language') ||
            normalized.includes('translation failed') ||
            normalized.includes('too many requests')
        );
    }

    buildPrompt(text, sourceLang, targetLang, langNames) {
        const targetName = langNames[targetLang] || targetLang;
        if (sourceLang === 'auto') {
            return `Translate the following text to ${targetName}. Output ONLY the translated text, nothing else.\n\nText: "${text}"`;
        }

        const sourceName = langNames[sourceLang] || sourceLang;
        return `Translate the following text from ${sourceName} to ${targetName}. Output ONLY the translated text, nothing else.\n\nText: "${text}"`;
    }

    commonPhraseTranslation(text, source, target) {
        const normalized = this.normalizeText(text).toLowerCase().replace(/[?.!,]+$/g, '');
        const phrases = {
            'en|hi': {
                hello: 'नमस्ते',
                hi: 'नमस्ते',
                'hello bro': 'नमस्ते भाई',
                'how are you': 'आप कैसे हैं',
                'hello bro how are you': 'नमस्ते भाई, आप कैसे हैं',
                'thank you': 'धन्यवाद',
                thanks: 'धन्यवाद',
                yes: 'हाँ',
                no: 'नहीं'
            },
            'hi|en': {
                'नमस्ते': 'Hello',
                'तुम कैसे हो': 'How are you?',
                'आप कैसे हैं': 'How are you?',
                'धन्यवाद': 'Thank you',
                'हाँ': 'Yes',
                'नहीं': 'No'
            }
        };
        return phrases[`${source}|${target}`]?.[normalized] || null;
    }

    async tryGemini(text, source, target, langNames) {
        if (!this.geminiApiKey || !this.providerAvailable('Gemini')) return null;

        try {
            const response = await axios.post(
                this.geminiUrl,
                {
                    model: this.geminiModel,
                    input: this.buildPrompt(text, source, target, langNames),
                    generation_config: {
                        temperature: 0.1,
                        max_output_tokens: 1024,
                    }
                },
                {
                    timeout: 4000,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': this.geminiApiKey
                    }
                }
            );

            const translated = (
                response.data?.output_text ||
                response.data?.output?.text ||
                response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                ''
            ).trim();

            if (translated && !this.hasInvalidProviderText(translated)) {
                console.log(`✅ [Gemini:${this.geminiModel}] "${text}" → "${translated}"`);
                return translated;
            }
        } catch (err) {
            const status = err?.response?.status;
            if (status === 429) this.cooldownProvider('Gemini', err);
            console.warn(`⚠️ Gemini translation failed: ${err.response?.data?.error?.message || err.message}`);
        }
        return null;
    }

    async tryGoogleTranslate(text, source, target) {
        if (!this.providerAvailable('Google Translate')) return null;

        try {
            const sl = source === 'auto' ? 'auto' : source;
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
            const response = await axios.get(url, { timeout: 4000 });

            if (response.data && response.data[0]) {
                const translated = response.data[0]
                    .filter(item => item && item[0])
                    .map(item => item[0])
                    .join('')
                    .trim();

                if (translated && !this.hasInvalidProviderText(translated)) {
                    console.log(`✅ [Google Translate] "${text}" → "${translated}"`);
                    return translated;
                }
            }
        } catch (err) {
            if (err?.response?.status === 429) this.cooldownProvider('Google Translate', err);
            console.error(`❌ Google Translate fallback failed: ${err.message}`);
        }
        return null;
    }

    async tryMyMemory(text, source, target) {
        if (source === 'auto' || !this.providerAvailable('MyMemory')) return null;

        try {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(source)}|${encodeURIComponent(target)}`;
            const response = await axios.get(url, { timeout: 4000 });
            const translated = response.data?.responseData?.translatedText?.trim();
            const status = Number(response.data?.responseStatus || response.status);

            if (status >= 400) throw new Error(response.data?.responseDetails || 'MyMemory failed');
            if (translated && !this.hasInvalidProviderText(translated)) {
                console.log(`✅ [MyMemory] "${text}" → "${translated}"`);
                return translated;
            }
        } catch (err) {
            if (err?.response?.status === 429) this.cooldownProvider('MyMemory', err);
            console.error(`❌ MyMemory fallback failed: ${err.message}`);
        }
        return null;
    }

    /**
     * Translates text to target language.
     * @param {string} text - Text to translate.
     * @param {string} sourceLang - Source language code or 'auto'.
     * @param {string} targetLang - Target language code (e.g., 'en', 'hi').
     * @returns {Promise<string>} - Translated text.
     */
    async translate(text, sourceLang, targetLang) {
        const cleanText = this.normalizeText(text);
        if (!cleanText) return text;

        const source = this.normalizeLang(sourceLang, 'auto');
        const target = this.normalizeLang(targetLang, 'en');
        if (source !== 'auto' && source === target) return cleanText;

        const cached = this.getCached(cleanText, source, target);
        if (cached) {
            console.log(`♻️ [Translation cache] "${cleanText}" → "${cached}"`);
            return cached;
        }

        const phrase = this.commonPhraseTranslation(cleanText, source, target);
        if (phrase) {
            this.setCached(cleanText, source, target, phrase);
            console.log(`⚡ [Phrase map] "${cleanText}" → "${phrase}"`);
            return phrase;
        }

        const langNames = {
            en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French',
            de: 'German', ta: 'Tamil', te: 'Telugu', mr: 'Marathi',
            bn: 'Bengali', gu: 'Gujarati', kn: 'Kannada', pa: 'Punjabi', ur: 'Urdu'
        };

        const providers = [
            () => this.tryGemini(cleanText, source, target, langNames),
            () => this.tryGoogleTranslate(cleanText, source, target),
            () => this.tryMyMemory(cleanText, source, target)
        ];

        for (const provider of providers) {
            const translated = await provider();
            if (translated) {
                this.setCached(cleanText, source, target, translated);
                return translated;
            }
        }

        console.warn(`⚠️ All translation methods failed. Returning original: "${cleanText}"`);
        return cleanText;
    }
}

export default new CallTranslationService();