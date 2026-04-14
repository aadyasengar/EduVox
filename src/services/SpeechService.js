import StorageService from './StorageService.js';

class SpeechService {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.voices = [];
    this.isListening = false;
    this.setupRecognition();
    this.setupSynthesis();
  }

  setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      const settings = StorageService.getSettings();
      this.recognition.lang = settings.voice.lang || 'en-US';
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }
  }

  setupSynthesis() {
    // Wait for voices to load
    const loadVoices = () => {
      this.voices = this.synthesis.getVoices();
    };
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
    loadVoices();
  }

  setLanguage(langCode) {
    if (this.recognition) {
      this.recognition.lang = langCode;
    }
  }

  startListening(onResult, onError, onEnd) {
    if (!this.recognition) return;
    
    // Refresh language from settings every boot
    const settings = StorageService.getSettings();
    this.recognition.lang = settings.voice.lang || 'en-US';
    
    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (onResult) onResult(finalTranscript, interimTranscript);
    };

    this.recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      if (onError) onError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onEnd) onEnd();
    };

    this.recognition.start();
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  speak(text, onEnd) {
    if (!this.synthesis) {
        if (onEnd) onEnd();
        return;
    }
    
    const settings = StorageService.getSettings();
    if (!settings.voice.enabled) {
        if (onEnd) onEnd();
        return;
    }

    // Stop any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const lang = settings.voice.lang || 'en-US';
    
    // Exact language subset matching for intelligent routing
    const voice = this.voices.find(v => v.lang === lang) || 
                  this.voices.find(v => v.lang.startsWith(lang.split('-')[0])) ||
                  this.voices.find(v => v.name.includes('Google UK English Female'));
                  
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.lang = lang;
    utterance.rate = settings.voice.rate || 1.0; 
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    this.synthesis.speak(utterance);
  }

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }
}

// Export as a singleton
const speechService = new SpeechService();
export default speechService;
