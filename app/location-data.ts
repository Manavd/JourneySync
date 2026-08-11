export type TripRegion = {
  code: string;
  name: string;
  cities: string[];
};

export type TripCountry = {
  code: string;
  name: string;
  currency: string;
  regionLabel: string;
  regions: TripRegion[];
};

const us = (code: string, name: string, cities: string[]): TripRegion => ({ code, name, cities });

export const TRIP_COUNTRIES: TripCountry[] = [
  {
    code: "US", name: "United States", currency: "USD", regionLabel: "State", regions: [
      us("AL", "Alabama", ["Birmingham", "Huntsville", "Montgomery"]),
      us("AK", "Alaska", ["Anchorage", "Fairbanks", "Juneau"]),
      us("AZ", "Arizona", ["Phoenix", "Scottsdale", "Tucson"]),
      us("AR", "Arkansas", ["Fayetteville", "Hot Springs", "Little Rock"]),
      us("CA", "California", ["Los Angeles", "San Diego", "San Francisco", "San Jose"]),
      us("CO", "Colorado", ["Aspen", "Boulder", "Denver"]),
      us("CT", "Connecticut", ["Hartford", "New Haven", "Stamford"]),
      us("DE", "Delaware", ["Dover", "Rehoboth Beach", "Wilmington"]),
      us("FL", "Florida", ["Key West", "Miami", "Orlando", "Tampa"]),
      us("GA", "Georgia", ["Atlanta", "Augusta", "Savannah"]),
      us("HI", "Hawaii", ["Hilo", "Honolulu", "Kailua-Kona"]),
      us("ID", "Idaho", ["Boise", "Coeur d'Alene", "Sun Valley"]),
      us("IL", "Illinois", ["Chicago", "Peoria", "Springfield"]),
      us("IN", "Indiana", ["Bloomington", "Indianapolis", "South Bend"]),
      us("IA", "Iowa", ["Cedar Rapids", "Des Moines", "Iowa City"]),
      us("KS", "Kansas", ["Kansas City", "Topeka", "Wichita"]),
      us("KY", "Kentucky", ["Lexington", "Louisville", "Paducah"]),
      us("LA", "Louisiana", ["Baton Rouge", "Lafayette", "New Orleans"]),
      us("ME", "Maine", ["Bangor", "Bar Harbor", "Portland"]),
      us("MD", "Maryland", ["Annapolis", "Baltimore", "Ocean City"]),
      us("MA", "Massachusetts", ["Boston", "Cambridge", "Nantucket"]),
      us("MI", "Michigan", ["Ann Arbor", "Detroit", "Grand Rapids"]),
      us("MN", "Minnesota", ["Duluth", "Minneapolis", "Saint Paul"]),
      us("MS", "Mississippi", ["Biloxi", "Jackson", "Oxford"]),
      us("MO", "Missouri", ["Branson", "Kansas City", "St. Louis"]),
      us("MT", "Montana", ["Billings", "Bozeman", "Missoula"]),
      us("NE", "Nebraska", ["Lincoln", "Omaha", "Scottsbluff"]),
      us("NV", "Nevada", ["Carson City", "Las Vegas", "Reno"]),
      us("NH", "New Hampshire", ["Concord", "Manchester", "Portsmouth"]),
      us("NJ", "New Jersey", ["Atlantic City", "Jersey City", "Newark"]),
      us("NM", "New Mexico", ["Albuquerque", "Santa Fe", "Taos"]),
      us("NY", "New York", ["Albany", "Buffalo", "New York City", "Rochester"]),
      us("NC", "North Carolina", ["Asheville", "Charlotte", "Raleigh"]),
      us("ND", "North Dakota", ["Bismarck", "Fargo", "Grand Forks"]),
      us("OH", "Ohio", ["Cincinnati", "Cleveland", "Columbus"]),
      us("OK", "Oklahoma", ["Norman", "Oklahoma City", "Tulsa"]),
      us("OR", "Oregon", ["Bend", "Eugene", "Portland"]),
      us("PA", "Pennsylvania", ["Harrisburg", "Philadelphia", "Pittsburgh"]),
      us("RI", "Rhode Island", ["Block Island", "Newport", "Providence"]),
      us("SC", "South Carolina", ["Charleston", "Columbia", "Myrtle Beach"]),
      us("SD", "South Dakota", ["Rapid City", "Sioux Falls", "Sturgis"]),
      us("TN", "Tennessee", ["Chattanooga", "Memphis", "Nashville"]),
      us("TX", "Texas", ["Austin", "Dallas", "Houston", "San Antonio"]),
      us("UT", "Utah", ["Moab", "Park City", "Salt Lake City"]),
      us("VT", "Vermont", ["Burlington", "Montpelier", "Stowe"]),
      us("VA", "Virginia", ["Alexandria", "Richmond", "Virginia Beach"]),
      us("WA", "Washington", ["Olympia", "Seattle", "Spokane"]),
      us("WV", "West Virginia", ["Charleston", "Harpers Ferry", "Morgantown"]),
      us("WI", "Wisconsin", ["Green Bay", "Madison", "Milwaukee"]),
      us("WY", "Wyoming", ["Casper", "Jackson", "Yellowstone"]),
      us("DC", "District of Columbia", ["Washington"]),
    ],
  },
  {
    code: "CA", name: "Canada", currency: "CAD", regionLabel: "Province or territory", regions: [
      { code: "AB", name: "Alberta", cities: ["Banff", "Calgary", "Edmonton"] },
      { code: "BC", name: "British Columbia", cities: ["Kelowna", "Vancouver", "Victoria"] },
      { code: "MB", name: "Manitoba", cities: ["Brandon", "Churchill", "Winnipeg"] },
      { code: "NB", name: "New Brunswick", cities: ["Fredericton", "Moncton", "Saint John"] },
      { code: "NL", name: "Newfoundland and Labrador", cities: ["Corner Brook", "Gander", "St. John's"] },
      { code: "NS", name: "Nova Scotia", cities: ["Halifax", "Lunenburg", "Sydney"] },
      { code: "NT", name: "Northwest Territories", cities: ["Inuvik", "Yellowknife"] },
      { code: "NU", name: "Nunavut", cities: ["Iqaluit"] },
      { code: "ON", name: "Ontario", cities: ["Niagara Falls", "Ottawa", "Toronto"] },
      { code: "PE", name: "Prince Edward Island", cities: ["Charlottetown"] },
      { code: "QC", name: "Quebec", cities: ["Montreal", "Quebec City", "Sherbrooke"] },
      { code: "SK", name: "Saskatchewan", cities: ["Regina", "Saskatoon"] },
      { code: "YT", name: "Yukon", cities: ["Whitehorse"] },
    ],
  },
  {
    code: "AU", name: "Australia", currency: "AUD", regionLabel: "State or territory", regions: [
      { code: "ACT", name: "Australian Capital Territory", cities: ["Canberra"] },
      { code: "NSW", name: "New South Wales", cities: ["Byron Bay", "Newcastle", "Sydney"] },
      { code: "NT", name: "Northern Territory", cities: ["Alice Springs", "Darwin"] },
      { code: "QLD", name: "Queensland", cities: ["Brisbane", "Cairns", "Gold Coast"] },
      { code: "SA", name: "South Australia", cities: ["Adelaide", "Kangaroo Island"] },
      { code: "TAS", name: "Tasmania", cities: ["Hobart", "Launceston"] },
      { code: "VIC", name: "Victoria", cities: ["Geelong", "Melbourne"] },
      { code: "WA", name: "Western Australia", cities: ["Broome", "Perth"] },
    ],
  },
  {
    code: "IN", name: "India", currency: "INR", regionLabel: "State or union territory", regions: [
      { code: "DL", name: "Delhi", cities: ["New Delhi"] },
      { code: "GA", name: "Goa", cities: ["Panaji", "Vasco da Gama"] },
      { code: "GJ", name: "Gujarat", cities: ["Ahmedabad", "Surat", "Vadodara"] },
      { code: "HP", name: "Himachal Pradesh", cities: ["Dharamshala", "Manali", "Shimla"] },
      { code: "KA", name: "Karnataka", cities: ["Bengaluru", "Mysuru"] },
      { code: "KL", name: "Kerala", cities: ["Kochi", "Kozhikode", "Thiruvananthapuram"] },
      { code: "MH", name: "Maharashtra", cities: ["Mumbai", "Nagpur", "Pune"] },
      { code: "PB", name: "Punjab", cities: ["Amritsar", "Ludhiana"] },
      { code: "RJ", name: "Rajasthan", cities: ["Jaipur", "Jodhpur", "Udaipur"] },
      { code: "TN", name: "Tamil Nadu", cities: ["Chennai", "Coimbatore", "Madurai"] },
      { code: "UP", name: "Uttar Pradesh", cities: ["Agra", "Lucknow", "Varanasi"] },
      { code: "WB", name: "West Bengal", cities: ["Darjeeling", "Kolkata"] },
    ],
  },
  { code: "GB", name: "United Kingdom", currency: "GBP", regionLabel: "Country", regions: [
    { code: "ENG", name: "England", cities: ["Bath", "London", "Manchester", "York"] },
    { code: "SCT", name: "Scotland", cities: ["Edinburgh", "Glasgow", "Inverness"] },
    { code: "WLS", name: "Wales", cities: ["Cardiff", "Swansea"] },
    { code: "NIR", name: "Northern Ireland", cities: ["Belfast", "Derry"] },
  ] },
  { code: "FR", name: "France", currency: "EUR", regionLabel: "Region", regions: [
    { code: "IDF", name: "Ile-de-France", cities: ["Paris", "Versailles"] },
    { code: "PAC", name: "Provence-Alpes-Cote d'Azur", cities: ["Cannes", "Marseille", "Nice"] },
    { code: "ARA", name: "Auvergne-Rhone-Alpes", cities: ["Annecy", "Chamonix", "Lyon"] },
    { code: "NAQ", name: "Nouvelle-Aquitaine", cities: ["Bordeaux", "Biarritz"] },
  ] },
  { code: "DE", name: "Germany", currency: "EUR", regionLabel: "State", regions: [
    { code: "BE", name: "Berlin", cities: ["Berlin"] },
    { code: "BY", name: "Bavaria", cities: ["Munich", "Nuremberg", "Rothenburg ob der Tauber"] },
    { code: "HE", name: "Hesse", cities: ["Frankfurt", "Wiesbaden"] },
    { code: "HH", name: "Hamburg", cities: ["Hamburg"] },
    { code: "NW", name: "North Rhine-Westphalia", cities: ["Cologne", "Dusseldorf"] },
  ] },
  { code: "IT", name: "Italy", currency: "EUR", regionLabel: "Region", regions: [
    { code: "LAZ", name: "Lazio", cities: ["Rome"] },
    { code: "LOM", name: "Lombardy", cities: ["Como", "Milan"] },
    { code: "TUS", name: "Tuscany", cities: ["Florence", "Pisa", "Siena"] },
    { code: "VEN", name: "Veneto", cities: ["Verona", "Venice"] },
    { code: "CAM", name: "Campania", cities: ["Amalfi", "Naples", "Sorrento"] },
  ] },
  { code: "ES", name: "Spain", currency: "EUR", regionLabel: "Autonomous community", regions: [
    { code: "CAT", name: "Catalonia", cities: ["Barcelona", "Girona"] },
    { code: "MAD", name: "Community of Madrid", cities: ["Madrid"] },
    { code: "AND", name: "Andalusia", cities: ["Granada", "Malaga", "Seville"] },
    { code: "VAL", name: "Valencian Community", cities: ["Alicante", "Valencia"] },
    { code: "BAL", name: "Balearic Islands", cities: ["Ibiza", "Palma"] },
  ] },
  { code: "JP", name: "Japan", currency: "JPY", regionLabel: "Prefecture", regions: [
    { code: "13", name: "Tokyo", cities: ["Tokyo"] },
    { code: "26", name: "Kyoto", cities: ["Kyoto"] },
    { code: "27", name: "Osaka", cities: ["Osaka"] },
    { code: "01", name: "Hokkaido", cities: ["Hakodate", "Sapporo"] },
    { code: "47", name: "Okinawa", cities: ["Naha"] },
  ] },
  { code: "MX", name: "Mexico", currency: "MXN", regionLabel: "State", regions: [
    { code: "CMX", name: "Mexico City", cities: ["Mexico City"] },
    { code: "JAL", name: "Jalisco", cities: ["Guadalajara", "Puerto Vallarta"] },
    { code: "ROO", name: "Quintana Roo", cities: ["Cancun", "Playa del Carmen", "Tulum"] },
    { code: "BCS", name: "Baja California Sur", cities: ["Cabo San Lucas", "La Paz"] },
    { code: "OAX", name: "Oaxaca", cities: ["Oaxaca City", "Puerto Escondido"] },
  ] },
  { code: "BR", name: "Brazil", currency: "BRL", regionLabel: "State", regions: [
    { code: "RJ", name: "Rio de Janeiro", cities: ["Buzios", "Rio de Janeiro"] },
    { code: "SP", name: "Sao Paulo", cities: ["Sao Paulo"] },
    { code: "BA", name: "Bahia", cities: ["Salvador"] },
    { code: "SC", name: "Santa Catarina", cities: ["Florianopolis"] },
    { code: "AM", name: "Amazonas", cities: ["Manaus"] },
  ] },
  { code: "CH", name: "Switzerland", currency: "CHF", regionLabel: "Canton", regions: [
    { code: "ZH", name: "Zurich", cities: ["Zurich"] },
    { code: "GE", name: "Geneva", cities: ["Geneva"] },
    { code: "BE", name: "Bern", cities: ["Bern", "Interlaken"] },
    { code: "LU", name: "Lucerne", cities: ["Lucerne"] },
    { code: "VS", name: "Valais", cities: ["Zermatt"] },
  ] },
  { code: "GR", name: "Greece", currency: "EUR", regionLabel: "Region", regions: [
    { code: "ATT", name: "Attica", cities: ["Athens"] },
    { code: "SAE", name: "South Aegean", cities: ["Mykonos", "Rhodes", "Santorini"] },
    { code: "CRE", name: "Crete", cities: ["Chania", "Heraklion"] },
    { code: "ION", name: "Ionian Islands", cities: ["Corfu", "Zakynthos"] },
  ] },
  { code: "NL", name: "Netherlands", currency: "EUR", regionLabel: "Province", regions: [
    { code: "NH", name: "North Holland", cities: ["Amsterdam", "Haarlem"] },
    { code: "ZH", name: "South Holland", cities: ["Rotterdam", "The Hague"] },
    { code: "UT", name: "Utrecht", cities: ["Utrecht"] },
    { code: "LI", name: "Limburg", cities: ["Maastricht"] },
  ] },
  { code: "AE", name: "United Arab Emirates", currency: "AED", regionLabel: "Emirate", regions: [
    { code: "AZ", name: "Abu Dhabi", cities: ["Abu Dhabi", "Al Ain"] },
    { code: "DU", name: "Dubai", cities: ["Dubai"] },
    { code: "SH", name: "Sharjah", cities: ["Sharjah"] },
    { code: "RK", name: "Ras Al Khaimah", cities: ["Ras Al Khaimah"] },
  ] },
  { code: "TH", name: "Thailand", currency: "THB", regionLabel: "Province", regions: [
    { code: "BKK", name: "Bangkok", cities: ["Bangkok"] },
    { code: "CNX", name: "Chiang Mai", cities: ["Chiang Mai"] },
    { code: "PKT", name: "Phuket", cities: ["Phuket"] },
    { code: "KBI", name: "Krabi", cities: ["Krabi"] },
  ] },
  { code: "PT", name: "Portugal", currency: "EUR", regionLabel: "District or region", regions: [
    { code: "LIS", name: "Lisbon", cities: ["Cascais", "Lisbon", "Sintra"] },
    { code: "POR", name: "Porto", cities: ["Porto"] },
    { code: "FAR", name: "Faro", cities: ["Faro", "Lagos"] },
    { code: "MAD", name: "Madeira", cities: ["Funchal"] },
  ] },
  { code: "NZ", name: "New Zealand", currency: "NZD", regionLabel: "Region", regions: [
    { code: "AUK", name: "Auckland", cities: ["Auckland"] },
    { code: "WGN", name: "Wellington", cities: ["Wellington"] },
    { code: "CAN", name: "Canterbury", cities: ["Christchurch", "Kaikoura"] },
    { code: "OTA", name: "Otago", cities: ["Dunedin", "Queenstown"] },
  ] },
  { code: "SG", name: "Singapore", currency: "SGD", regionLabel: "Region", regions: [
    { code: "SG", name: "Singapore", cities: ["Singapore"] },
  ] },
];

export const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY", "CHF", "MXN", "BRL", "AED", "THB", "NZD", "SGD"];

export function countryByCode(code?: string): TripCountry | undefined {
  return TRIP_COUNTRIES.find((country) => country.code === code);
}

export function regionByCode(countryCode?: string, regionCode?: string): TripRegion | undefined {
  return countryByCode(countryCode)?.regions.find((region) => region.code === regionCode);
}

export function currencyForCountry(countryCode?: string): string {
  return countryByCode(countryCode)?.currency || "USD";
}

export function inferCountryCode(searchText: string): string | undefined {
  const normalized = searchText.toLocaleLowerCase();
  if (!normalized.trim()) return undefined;
  return TRIP_COUNTRIES.find((country) =>
    normalized.includes(country.name.toLocaleLowerCase()) ||
    country.regions.some((region) =>
      normalized.includes(region.name.toLocaleLowerCase()) ||
      region.cities.some((city) => normalized.includes(city.toLocaleLowerCase())),
    ),
  )?.code;
}
