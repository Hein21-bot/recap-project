// ElevenLabs Voice Character Configurations
export const VOICES = {
  sadaltager: {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sadaltager",
    description: "အသံအေးအေး၊ နက်နက်ရှိုင်းရှိုင်း - Knowledge Sharing အတွက် အကောင်းဆုံး",
    style: "calm",
    settings: {
      stability: 0.75,
      similarity_boost: 0.85,
      style: 0.2,
      use_speaker_boost: true,
    },
  },
  energetic: {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam (Energetic)",
    description: "အသံကြက်သီး၊ လူငယ်ဆန် - Funny/Energetic Content အတွက်",
    style: "energetic",
    settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.6,
      use_speaker_boost: true,
    },
  },
  documentary: {
    id: "VR6AewLTigWG4xSOukaG",
    name: "Arnold (Documentary)",
    description: "အသံနက် Documentary စတိုင် - Sad/Serious Content အတွက်",
    style: "documentary",
    settings: {
      stability: 0.85,
      similarity_boost: 0.9,
      style: 0.1,
      use_speaker_boost: false,
    },
  },
  youthful: {
    id: "jBpfuIE2acCO8z3wKNLl",
    name: "Gigi (Youthful)",
    description: "လူငယ်ဆန်သော အသံ - Entertainment Content အတွက်",
    style: "youthful",
    settings: {
      stability: 0.55,
      similarity_boost: 0.8,
      style: 0.45,
      use_speaker_boost: true,
    },
  },
};

// Tone/Mood Configurations
export const TONES = {
  knowledge: {
    name: "Knowledge Sharing",
    description: "အသိပညာမျှဝေ - အေးဆေးတည်ငြိမ်",
    speedMultiplier: 1.3,
    pauseDuration: "long",    // Longer pauses between sentences
    emphasisStyle: "subtle",
    voiceRecommendation: "sadaltager",
  },
  funny: {
    name: "Funny / Energetic",
    description: "ဖျော်ဖြေ/စွမ်းအင်ပြည့် - မြင့်မားသော",
    speedMultiplier: 1.25,
    pauseDuration: "short",
    emphasisStyle: "strong",
    voiceRecommendation: "energetic",
  },
  documentary: {
    name: "Sad / Documentary",
    description: "ဒိုင်ကျူမင်တရီ - နက်ရှိုင်းသော",
    speedMultiplier: 1.25,
    pauseDuration: "very_long",
    emphasisStyle: "dramatic",
    voiceRecommendation: "documentary",
  },
  educational: {
    name: "Educational",
    description: "ပညာသင်ကြားရေး - ရှင်းလင်းတိကျ",
    speedMultiplier: 1.25,
    pauseDuration: "medium",
    emphasisStyle: "clear",
    voiceRecommendation: "sadaltager",
  },
};

// Pause markers for script formatting
export const PAUSE_MARKERS = {
  micro: "...",          // 0.3s pause
  short: "[pause]",      // 0.5s pause
  medium: "[pause2]",    // 1.0s pause
  long: "[pause3]",      // 1.5s pause
};

export const SSML_BREAKS = {
  micro: '<break time="300ms"/>',
  short: '<break time="500ms"/>',
  medium: '<break time="1000ms"/>',
  long: '<break time="1500ms"/>',
};
