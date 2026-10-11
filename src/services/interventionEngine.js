/**
 * HeatGuard - Intervention engine (browser side).
 * The calibrated deterministic engine is shared with AWS Lambda (backend/src/core); Amazon Bedrock
 * plans arrive through the cloud API (see services/cloudApi.js and hooks/useAiIntervention.js).
 */

export {
  generateInterventionPackage,
  prettyModelName,
  LOCAL_ENGINE,
} from '../../backend/src/core/interventionEngine.js';

/**
 * Text-to-Speech audio announcement using Web Speech API
 */
export function speakDirective(text, lang = 'en') {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  window.speechSynthesis.cancel(); // Stop any pending speech
  const utterance = new SpeechSynthesisUtterance(text);

  const langCodes = {
    en: 'en-US',
    hi: 'hi-IN',
    ta: 'ta-IN',
  };

  utterance.lang = langCodes[lang] || 'en-US';
  utterance.rate = 0.95; // Slightly slower for clear outdoor comprehension
  utterance.pitch = 1.0;

  // Try to pick appropriate native voice if available
  const voices = window.speechSynthesis.getVoices();
  const targetVoice = voices.find((v) => v.lang.startsWith(utterance.lang));
  if (targetVoice) {
    utterance.voice = targetVoice;
  }

  window.speechSynthesis.speak(utterance);
}
