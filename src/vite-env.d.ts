/// <reference types="vite/client" />

// Extend Window interface for speech recognition
interface Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}
