package com.manavdesai.journeysync;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** The native copy of the country, region, city, and currency choices used by the web app. */
public final class LocationData {
    public static final class Region {
        public final String code;
        public final String name;
        public final List<String> cities;

        Region(String code, String name, String... cities) {
            this.code = code;
            this.name = name;
            this.cities = Collections.unmodifiableList(Arrays.asList(cities));
        }
    }

    public static final class Country {
        public final String code;
        public final String name;
        public final String currency;
        public final String regionLabel;
        public final List<Region> regions;

        Country(String code, String name, String currency, String regionLabel, Region... regions) {
            this.code = code;
            this.name = name;
            this.currency = currency;
            this.regionLabel = regionLabel;
            this.regions = Collections.unmodifiableList(Arrays.asList(regions));
        }
    }

    private static Region r(String code, String name, String... cities) {
        return new Region(code, name, cities);
    }

    public static final List<Country> COUNTRIES = Collections.unmodifiableList(Arrays.asList(
            new Country("US", "United States", "USD", "State",
                    r("AL", "Alabama", "Birmingham", "Huntsville", "Montgomery"), r("AK", "Alaska", "Anchorage", "Fairbanks", "Juneau"),
                    r("AZ", "Arizona", "Phoenix", "Scottsdale", "Tucson"), r("AR", "Arkansas", "Fayetteville", "Hot Springs", "Little Rock"),
                    r("CA", "California", "Los Angeles", "San Diego", "San Francisco", "San Jose"), r("CO", "Colorado", "Aspen", "Boulder", "Denver"),
                    r("CT", "Connecticut", "Hartford", "New Haven", "Stamford"), r("DE", "Delaware", "Dover", "Rehoboth Beach", "Wilmington"),
                    r("FL", "Florida", "Key West", "Miami", "Orlando", "Tampa"), r("GA", "Georgia", "Atlanta", "Augusta", "Savannah"),
                    r("HI", "Hawaii", "Hilo", "Honolulu", "Kailua-Kona"), r("ID", "Idaho", "Boise", "Coeur d'Alene", "Sun Valley"),
                    r("IL", "Illinois", "Chicago", "Peoria", "Springfield"), r("IN", "Indiana", "Bloomington", "Indianapolis", "South Bend"),
                    r("IA", "Iowa", "Cedar Rapids", "Des Moines", "Iowa City"), r("KS", "Kansas", "Kansas City", "Topeka", "Wichita"),
                    r("KY", "Kentucky", "Lexington", "Louisville", "Paducah"), r("LA", "Louisiana", "Baton Rouge", "Lafayette", "New Orleans"),
                    r("ME", "Maine", "Bangor", "Bar Harbor", "Portland"), r("MD", "Maryland", "Annapolis", "Baltimore", "Ocean City"),
                    r("MA", "Massachusetts", "Boston", "Cambridge", "Nantucket"), r("MI", "Michigan", "Ann Arbor", "Detroit", "Grand Rapids"),
                    r("MN", "Minnesota", "Duluth", "Minneapolis", "Saint Paul"), r("MS", "Mississippi", "Biloxi", "Jackson", "Oxford"),
                    r("MO", "Missouri", "Branson", "Kansas City", "St. Louis"), r("MT", "Montana", "Billings", "Bozeman", "Missoula"),
                    r("NE", "Nebraska", "Lincoln", "Omaha", "Scottsbluff"), r("NV", "Nevada", "Carson City", "Las Vegas", "Reno"),
                    r("NH", "New Hampshire", "Concord", "Manchester", "Portsmouth"), r("NJ", "New Jersey", "Atlantic City", "Jersey City", "Newark"),
                    r("NM", "New Mexico", "Albuquerque", "Santa Fe", "Taos"), r("NY", "New York", "Albany", "Buffalo", "New York City", "Rochester"),
                    r("NC", "North Carolina", "Asheville", "Charlotte", "Raleigh"), r("ND", "North Dakota", "Bismarck", "Fargo", "Grand Forks"),
                    r("OH", "Ohio", "Cincinnati", "Cleveland", "Columbus"), r("OK", "Oklahoma", "Norman", "Oklahoma City", "Tulsa"),
                    r("OR", "Oregon", "Bend", "Eugene", "Portland"), r("PA", "Pennsylvania", "Harrisburg", "Philadelphia", "Pittsburgh"),
                    r("RI", "Rhode Island", "Block Island", "Newport", "Providence"), r("SC", "South Carolina", "Charleston", "Columbia", "Myrtle Beach"),
                    r("SD", "South Dakota", "Rapid City", "Sioux Falls", "Sturgis"), r("TN", "Tennessee", "Chattanooga", "Memphis", "Nashville"),
                    r("TX", "Texas", "Austin", "Dallas", "Houston", "San Antonio"), r("UT", "Utah", "Moab", "Park City", "Salt Lake City"),
                    r("VT", "Vermont", "Burlington", "Montpelier", "Stowe"), r("VA", "Virginia", "Alexandria", "Richmond", "Virginia Beach"),
                    r("WA", "Washington", "Olympia", "Seattle", "Spokane"), r("WV", "West Virginia", "Charleston", "Harpers Ferry", "Morgantown"),
                    r("WI", "Wisconsin", "Green Bay", "Madison", "Milwaukee"), r("WY", "Wyoming", "Casper", "Jackson", "Yellowstone"),
                    r("DC", "District of Columbia", "Washington")),
            new Country("CA", "Canada", "CAD", "Province or territory", r("AB", "Alberta", "Banff", "Calgary", "Edmonton"), r("BC", "British Columbia", "Kelowna", "Vancouver", "Victoria"), r("ON", "Ontario", "Niagara Falls", "Ottawa", "Toronto"), r("QC", "Quebec", "Montreal", "Quebec City")),
            new Country("AU", "Australia", "AUD", "State or territory", r("NSW", "New South Wales", "Sydney", "Byron Bay"), r("QLD", "Queensland", "Brisbane", "Cairns"), r("VIC", "Victoria", "Melbourne"), r("WA", "Western Australia", "Perth")),
            new Country("IN", "India", "INR", "State or union territory", r("DL", "Delhi", "New Delhi"), r("GA", "Goa", "Panaji"), r("KA", "Karnataka", "Bengaluru", "Mysuru"), r("MH", "Maharashtra", "Mumbai", "Pune"), r("RJ", "Rajasthan", "Jaipur", "Udaipur")),
            new Country("GB", "United Kingdom", "GBP", "Country", r("ENG", "England", "London", "Manchester", "York"), r("SCT", "Scotland", "Edinburgh", "Glasgow"), r("WLS", "Wales", "Cardiff"), r("NIR", "Northern Ireland", "Belfast")),
            new Country("FR", "France", "EUR", "Region", r("IDF", "Ile-de-France", "Paris", "Versailles"), r("PAC", "Provence-Alpes-Cote d'Azur", "Cannes", "Marseille", "Nice"), r("ARA", "Auvergne-Rhone-Alpes", "Annecy", "Lyon")),
            new Country("DE", "Germany", "EUR", "State", r("BE", "Berlin", "Berlin"), r("BY", "Bavaria", "Munich", "Nuremberg"), r("HE", "Hesse", "Frankfurt"), r("HH", "Hamburg", "Hamburg")),
            new Country("IT", "Italy", "EUR", "Region", r("LAZ", "Lazio", "Rome"), r("LOM", "Lombardy", "Milan", "Como"), r("TUS", "Tuscany", "Florence", "Pisa", "Siena"), r("VEN", "Veneto", "Venice", "Verona")),
            new Country("ES", "Spain", "EUR", "Autonomous community", r("CAT", "Catalonia", "Barcelona", "Girona"), r("MAD", "Community of Madrid", "Madrid"), r("AND", "Andalusia", "Granada", "Seville")),
            new Country("JP", "Japan", "JPY", "Prefecture", r("13", "Tokyo", "Tokyo"), r("26", "Kyoto", "Kyoto"), r("27", "Osaka", "Osaka"), r("01", "Hokkaido", "Sapporo")),
            new Country("MX", "Mexico", "MXN", "State", r("CMX", "Mexico City", "Mexico City"), r("JAL", "Jalisco", "Guadalajara", "Puerto Vallarta"), r("ROO", "Quintana Roo", "Cancun", "Tulum")),
            new Country("BR", "Brazil", "BRL", "State", r("RJ", "Rio de Janeiro", "Rio de Janeiro"), r("SP", "Sao Paulo", "Sao Paulo"), r("BA", "Bahia", "Salvador")),
            new Country("CH", "Switzerland", "CHF", "Canton", r("ZH", "Zurich", "Zurich"), r("GE", "Geneva", "Geneva"), r("BE", "Bern", "Bern", "Interlaken"), r("VS", "Valais", "Zermatt")),
            new Country("GR", "Greece", "EUR", "Region", r("ATT", "Attica", "Athens"), r("SAE", "South Aegean", "Mykonos", "Santorini"), r("CRE", "Crete", "Chania")),
            new Country("NL", "Netherlands", "EUR", "Province", r("NH", "North Holland", "Amsterdam", "Haarlem"), r("ZH", "South Holland", "Rotterdam", "The Hague")),
            new Country("AE", "United Arab Emirates", "AED", "Emirate", r("AZ", "Abu Dhabi", "Abu Dhabi", "Al Ain"), r("DU", "Dubai", "Dubai"), r("SH", "Sharjah", "Sharjah")),
            new Country("TH", "Thailand", "THB", "Province", r("BKK", "Bangkok", "Bangkok"), r("CNX", "Chiang Mai", "Chiang Mai"), r("PKT", "Phuket", "Phuket")),
            new Country("PT", "Portugal", "EUR", "District or region", r("LIS", "Lisbon", "Lisbon", "Sintra"), r("POR", "Porto", "Porto"), r("FAR", "Faro", "Faro", "Lagos")),
            new Country("NZ", "New Zealand", "NZD", "Region", r("AUK", "Auckland", "Auckland"), r("WGN", "Wellington", "Wellington"), r("CAN", "Canterbury", "Christchurch"), r("OTA", "Otago", "Queenstown")),
            new Country("SG", "Singapore", "SGD", "Region", r("SG", "Singapore", "Singapore"))
    ));

    private LocationData() {}

    public static Country country(String code) {
        for (Country country : COUNTRIES) if (country.code.equalsIgnoreCase(code)) return country;
        return COUNTRIES.get(0);
    }

    public static int countryIndex(String code) {
        for (int i = 0; i < COUNTRIES.size(); i++) if (COUNTRIES.get(i).code.equalsIgnoreCase(code)) return i;
        return 0;
    }

    public static int regionIndex(Country country, String code) {
        if (country != null) for (int i = 0; i < country.regions.size(); i++) if (country.regions.get(i).code.equalsIgnoreCase(code)) return i;
        return 0;
    }

    public static List<String> countryNames() {
        List<String> values = new ArrayList<>();
        for (Country country : COUNTRIES) values.add(country.name);
        return values;
    }
}
