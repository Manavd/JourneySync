export type CountryEmergencyInfo = {
  countryCode: string;
  countryName: string;
  general: string;
  police: string;
  ambulance: string;
  fire: string;
  language: string;
  phrases: Array<{ english: string; local: string; pronunciation?: string }>;
  touristHelpline?: string;
  notes?: string;
};

export const EMERGENCY_DIRECTORY: Record<string, CountryEmergencyInfo> = {
  CH: {
    countryCode: "CH",
    countryName: "Switzerland",
    general: "112",
    police: "117",
    ambulance: "144",
    fire: "118",
    language: "German / French / Italian",
    phrases: [
      { english: "I need a doctor", local: "Ich brauche einen Arzt", pronunciation: "Ikh brow-kheh eye-nen artst" },
      { english: "Where is the hospital?", local: "Wo ist das Krankenhaus?", pronunciation: "Voh ist dahs krahn-ken-hows" },
      { english: "Please call police", local: "Bitte rufen Sie die Polizei", pronunciation: "Bit-teh roo-fen zee dee po-lee-tsye" },
      { english: "Help!", local: "Hilfe!", pronunciation: "Hil-feh" },
      { english: "I have an emergency", local: "Ich habe einen Notfall", pronunciation: "Ikh hah-beh eye-nen noht-fahl" },
    ],
    touristHelpline: "+41 800 100 200",
    notes: "Rega air-rescue can be reached at 1414 in Switzerland.",
  },
  US: {
    countryCode: "US",
    countryName: "United States",
    general: "911",
    police: "911",
    ambulance: "911",
    fire: "911",
    language: "English",
    phrases: [
      { english: "I need immediate medical attention", local: "I need immediate medical attention" },
      { english: "Where is the nearest emergency room?", local: "Where is the nearest emergency room?" },
      { english: "Call 911 immediately", local: "Call 911 immediately" },
    ],
    touristHelpline: "311 (Non-emergency city services)",
    notes: "Dial 911 for all emergencies nationwide.",
  },
  CA: {
    countryCode: "CA",
    countryName: "Canada",
    general: "911",
    police: "911",
    ambulance: "911",
    fire: "911",
    language: "English / French",
    phrases: [
      { english: "I need an ambulance", local: "J'ai besoin d'une ambulance" },
      { english: "Where is the hospital?", local: "Où est l'hôpital?" },
      { english: "Help!", local: "Au secours!" },
    ],
    touristHelpline: "211 (Community & Social Services)",
    notes: "Dial 911 for all police, fire, and medical emergencies.",
  },
  GB: {
    countryCode: "GB",
    countryName: "United Kingdom",
    general: "999 / 112",
    police: "999",
    ambulance: "999",
    fire: "999",
    language: "English",
    phrases: [
      { english: "I need urgent medical help", local: "I need urgent medical help (Dial 111 for non-emergency NHS)" },
      { english: "Where is the nearest A&E (Emergency)?", local: "Where is the nearest A&E?" },
    ],
    touristHelpline: "111 (NHS non-emergency medical advice)",
    notes: "112 also works on all UK mobile phones.",
  },
  FR: {
    countryCode: "FR",
    countryName: "France",
    general: "112",
    police: "17",
    ambulance: "15 (SAMU)",
    fire: "18 (Sapeurs-Pompiers)",
    language: "French",
    phrases: [
      { english: "I need a doctor", local: "J'ai besoin d'un médecin", pronunciation: "Zhay buh-zwan durn mayd-sahn" },
      { english: "Where is the hospital?", local: "Où est l'hôpital le plus proche?", pronunciation: "Oo ay low-pee-tahl luh ploo prosh" },
      { english: "Please call an ambulance", local: "Appelez une ambulance s'il vous plaît", pronunciation: "Ah-play oon ahm-boo-lahns seel voo play" },
      { english: "Help!", local: "Au secours!", pronunciation: "Oh suh-koor" },
    ],
    touristHelpline: "3919 (National emergency support)",
  },
  IT: {
    countryCode: "IT",
    countryName: "Italy",
    general: "112",
    police: "113",
    ambulance: "118",
    fire: "115",
    language: "Italian",
    phrases: [
      { english: "I need a doctor", local: "Ho bisogno di un medico", pronunciation: "Oh bee-zon-yoh dee oon meh-dee-koh" },
      { english: "Where is the hospital?", local: "Dov'è l'ospedale?", pronunciation: "Doh-veh loss-peh-dah-leh" },
      { english: "Call police!", local: "Chiamate la polizia!", pronunciation: "Kyah-mah-teh lah poh-lee-tsee-ah" },
      { english: "Help!", local: "Aiuto!", pronunciation: "Ah-yoo-toh" },
    ],
    touristHelpline: "+39 06 0608 (Rome tourist assistance)",
  },
  DE: {
    countryCode: "DE",
    countryName: "Germany",
    general: "112",
    police: "110",
    ambulance: "112",
    fire: "112",
    language: "German",
    phrases: [
      { english: "I need a doctor", local: "Ich brauche einen Arzt", pronunciation: "Ikh brow-kheh eye-nen artst" },
      { english: "Where is the hospital?", local: "Wo ist das nächste Krankenhaus?", pronunciation: "Voh ist dahs naykh-steh krahn-ken-hows" },
      { english: "Help!", local: "Hilfe!", pronunciation: "Hil-feh" },
    ],
    touristHelpline: "116 117 (On-call medical services)",
  },
  JP: {
    countryCode: "JP",
    countryName: "Japan",
    general: "110 / 119",
    police: "110",
    ambulance: "119",
    fire: "119",
    language: "Japanese",
    phrases: [
      { english: "I need a doctor", local: "医者を呼んでください", pronunciation: "Isha o yonde kudasai" },
      { english: "Where is the hospital?", local: "病院はどこですか？", pronunciation: "Byōin wa doko desu ka?" },
      { english: "Help!", local: "助けて！", pronunciation: "Tasukete!" },
      { english: "I don't understand Japanese", local: "日本語がわかりません", pronunciation: "Nihongo ga wakarimasen" },
    ],
    touristHelpline: "050-3816-2720 (Japan Visitor Hotline, 24/7 in English)",
  },
  ES: {
    countryCode: "ES",
    countryName: "Spain",
    general: "112",
    police: "091 (National) / 092 (Local)",
    ambulance: "061",
    fire: "080",
    language: "Spanish",
    phrases: [
      { english: "I need a doctor", local: "Necesito un médico", pronunciation: "Neh-seh-see-toh oon meh-dee-koh" },
      { english: "Where is the hospital?", local: "¿Dónde está el hospital más cercano?", pronunciation: "Dohn-deh ess-tah el oss-pee-tahl mas sehr-kah-noh" },
      { english: "Help!", local: "¡Ayuda!", pronunciation: "Ah-yoo-dah" },
    ],
    touristHelpline: "+34 902 102 112 (SATE Tourist police in English)",
  },
  AU: {
    countryCode: "AU",
    countryName: "Australia",
    general: "000",
    police: "000",
    ambulance: "000",
    fire: "000",
    language: "English",
    phrases: [
      { english: "I need an ambulance", local: "I need an ambulance (Triple Zero - 000)" },
      { english: "Where is the hospital emergency department?", local: "Where is the hospital emergency department?" },
    ],
    touristHelpline: "131 444 (Non-emergency Police)",
    notes: "112 also routes to 000 from mobile phones in Australia.",
  },
};

export function getEmergencyInfo(countryCode?: string): CountryEmergencyInfo {
  const code = (countryCode || "CH").toUpperCase();
  if (EMERGENCY_DIRECTORY[code]) {
    return EMERGENCY_DIRECTORY[code];
  }
  return {
    countryCode: code,
    countryName: "International",
    general: "112",
    police: "112",
    ambulance: "112",
    fire: "112",
    language: "English / Local",
    phrases: [
      { english: "I need medical help", local: "I need medical help" },
      { english: "Where is the nearest hospital?", local: "Where is the nearest hospital?" },
      { english: "Emergency! Call police", local: "Emergency! Call police" },
    ],
    touristHelpline: "Contact your local embassy or consulate",
    notes: "112 is the standard GSM international emergency number supported on mobile networks worldwide.",
  };
}
