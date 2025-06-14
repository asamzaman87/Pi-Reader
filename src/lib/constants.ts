import { Accept } from "react-dropzone";

export const THEME_STORAGE_KEY = "gptr/theme";
export const MAX_FILES = 1;
export const ACCEPTED_FILE_TYPES: Accept = {
  "application/pdf": [],
  "application/msword": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [],
  "text/plain": [],
};

export const ACCEPTED_FILE_TYPES_FIREFOX: Accept = {
  "text/plain": [".txt"],
};

export const LISTENERS = {
  "RECEIVED_MESSAGE_ID": "RECEIVED_MESSAGE_ID",
  "RATE_LIMIT_EXCEEDED": "RATE_LIMIT_EXCEEDED",
  "END_OF_STREAM": "END_OF_STREAM",
  "ERROR": "ERROR",
  "AUTH_RECEIVED": "AUTH_RECEIVED",
  "SIGNOUT_RECEIVED": "SIGNOUT_RECEIVED",
  "CONVERSATION_STOPPED": "CONVERSATION_STOPPED",
  "VOICES": "VOICES",
  "LOADING_ON_VOICE": "LOADING_ON_VOICE",
  "GET_VOICES": "GET_VOICES",
  "STOP_CONVERSATION": "STOP_CONVERSATION",
  "AUDIO_ENDED": "ended",
  "GET_TOKEN": "GET_TOKEN",
  "SET_AUDIO_URL": 'SET_AUDIO_URL'
}

export const PI_VOICE_OTHER_INFO:any = {
  voice1: {
    gender: 'male',
    info: 'Friendly and clear'
  },
  voice2: {
    gender: 'female',
    info: 'Confident and enthusiastic'
  },
  voice3: {
    gender: 'male',
    info: 'Thoughtful and calm'
  },
  voice4: {
      gender: 'female',
      info: 'Engaging and dynamic'
    },
  voice5: {
      gender: 'female',
      info: 'Warm and comforting'
    },
  voice6: {
      gender: 'male',
      info: 'Sophisticated and expressive'
  },
  voice7: {
      gender: 'female',
      info: 'Helpful and informative'
  },
  voice8: {
      gender: 'male',
      info: 'Reflective and empathetic'
  },
}
export const MAX_FILE_SIZE = 1024 * 1024 * 24; // 24MB
export const PROMPT_INPUT_SELECTOR = "textarea[role='textbox']";
export const SUBMIT_BUTTON_SELECTOR  = "[aria-label='Submit text']";
export const HELPER_PROMPT = "Repeat the text in this prompt without any changes, introduction or additional words. Do not summarize, analyze, or prepend/append anything. Just output this text exactly as provided:"
export const SYNTETHIZE_ENDPOINT = "https://chatgpt.com/backend-api/synthesize";
export const VOICE = "";
export const AUDIO_FORMAT = "aac";
export const CHUNK_SIZE = 300;
export const TOAST_STYLE_CONFIG = { backgroundColor: "darkred", color: "#fff", border: "1px solid #b30000" }
export const TOAST_STYLE_CONFIG_INFO = { backgroundColor: "darkblue", color: "#fff", border: "1px solid #001aff" }
export const PLAY_RATE_STEP = 0.25;
export const DOMAINS = ["pi.ai", "pi.ai"];
export const MATCH_URLS = ["https://pi.ai/*"];
export const FEEDBACK_ENDPOINT = "https://www.readeon.com/api/feedbacks/gpt-feedback";
export const FEEDBACK_GOOGLE_FORM = "https://docs.google.com/forms/d/e/1FAIpQLScg5UUqvat9zBFcXOKe4hzc1xQd7KCXzjqjBGbHgfbSqhDxjA/viewform?usp=header";
export const UNINSTALL_GOOGLE_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSfdA6qXAw11ojS2Z9uBIrb2M1-wBmXG4EnCqI_xksjAq0QxmA/viewform?usp=sharing&ouid=105161295630410831674";
export const YOUTUBE_FAQ_VIDEO = "https://youtu.be/zhiRjPAtOHI";
export const MAX_SLIDER_VALUE = 2;
export const MIN_SLIDER_VALUE = 0.5;
export const STEP_SLIDER_VALUE = 0.1;
export const TICKS_TO_DISPLAY = [0.5, 1, 1.5, 2];
export const MODELS_TO_REJECT = ["o1"];
export const CHUNK_TO_PAUSE_ON = 9; //end of chunk
export const LOADING_TIMEOUT = 25000;
export const LOADING_TIMEOUT_FOR_DOWNLOAD = 40000;
export const DOWLOAD_CHUNK_SIZE = 4000;
export const PI_VOICE_STREAM_URL: string | null = "https://pi.ai/api/chat/voice"
export const PI_CHAT_URL: string = "https://pi.ai/api/v2/chat";
export const PI_START_URL: string = 'https://pi.ai/api/chat/start';
export const REVIEWS_CHROME = "https://chromewebstore.google.com/detail/gpt-reader-free-ai-text-t/aeggkceabpfajnglgaeadofdmeboimml/reviews";
export const REVIEWS_FIREFOX = "https://addons.mozilla.org/en-US/firefox/addon/gpt-reader";