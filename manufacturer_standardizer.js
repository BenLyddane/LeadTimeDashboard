const fs = require('fs-extra');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class ManufacturerStandardizer {
    constructor() {
        this.standardizationMap = new Map();
        this.cleanedData = [];
        this.setupStandardizationRules();
    }

    setupStandardizationRules() {
        // Define standardization mappings
        const mappings = {
            // Case and spelling standardization
            'aaon': 'AAON',
            'AAON': 'AAON',
            'Aaon': 'AAON',
            
            'stulz': 'Stulz',
            'STULZ': 'Stulz',
            'Stulz': 'Stulz',
            
            'vertiv': 'Vertiv',
            'VERTIV': 'Vertiv',
            'Vertiv': 'Vertiv',
            
            'trane': 'Trane',
            'TRANE': 'Trane',
            'Trane': 'Trane',
            
            'daikin': 'Daikin',
            'DAIKIN': 'Daikin',
            'Daikin': 'Daikin',
            'daikin applied': 'Daikin Applied',
            'Daikin Applied': 'Daikin Applied',
            'DAIKIN APPLIED': 'Daikin Applied',
            
            'mitsubishi': 'Mitsubishi',
            'MITSUBISHI': 'Mitsubishi',
            'Mitsubishi': 'Mitsubishi',
            'mitusbishi': 'Mitsubishi', // Fix spelling error
            'Mitusbishi': 'Mitsubishi',
            'trane-mitsubishi': 'Trane-Mitsubishi',
            'Trane-Mitsubishi': 'Trane-Mitsubishi',
            'trane/mitsubishi': 'Trane/Mitsubishi',
            'Trane/Mitsubishi': 'Trane/Mitsubishi',
            
            'armstrong': 'Armstrong',
            'ARMSTRONG': 'Armstrong',
            'Armstrong': 'Armstrong',
            'armstrong fluid technology': 'Armstrong Fluid Technology',
            'Armstrong Fluid Technology': 'Armstrong Fluid Technology',
            
            'above air': 'Above Air',
            'Above Air': 'Above Air',
            'ABOVE AIR': 'Above Air',
            'above air ': 'Above Air', // Trim whitespace
            'Above-Air': 'Above Air',
            
            'krueger': 'Krueger',
            'KRUEGER': 'Krueger',
            'Krueger': 'Krueger',
            'krueger ': 'Krueger',
            
            'twin city': 'Twin City Fan',
            'Twin City': 'Twin City Fan',
            'twin city fan': 'Twin City Fan',
            'Twin City Fan': 'Twin City Fan',
            'twin city fans': 'Twin City Fan',
            'Twin City Fans': 'Twin City Fan',
            'twin city fan ': 'Twin City Fan',
            'Twin City Fan ': 'Twin City Fan',
            'twin cIty': 'Twin City Fan', // Fix case
            'Twin CIty': 'Twin City Fan',
            'twin city fan/ abb vfds': 'Twin City Fan',
            'Twin City Fan/ ABB VFDs': 'Twin City Fan',
            'twin city fan/ abb vfds ': 'Twin City Fan',
            'Twin City Fan/ ABB VFDs ': 'Twin City Fan',
            'twin city fans & abb vfds': 'Twin City Fan',
            'Twin City Fans & ABB VFDS': 'Twin City Fan',
            'twin city fan/ abb': 'Twin City Fan',
            'Twin City Fan/ ABB': 'Twin City Fan',
            
            'greenheck': 'Greenheck',
            'GREENHECK': 'Greenheck',
            'Greenheck': 'Greenheck',
            'greenheck fans & franklin controls starters': 'Greenheck',
            'GREENHECK FANS & FRANKLIN CONTROLS STARTERS': 'Greenheck',
            
            'loren cook': 'Loren Cook',
            'LOREN COOK': 'Loren Cook',
            'Loren Cook': 'Loren Cook',
            'loren cook': 'Loren Cook',
            'cook': 'Loren Cook',
            'COOK': 'Loren Cook',
            'Cook': 'Loren Cook',
            
            'indeeco': 'Indeeco',
            'INDEECO': 'Indeeco',
            'Indeeco': 'Indeeco',
            'indeeco ': 'Indeeco',
            
            'anemostat': 'Anemostat',
            'ANEMOSTAT': 'Anemostat',
            'Anemostat': 'Anemostat',
            
            'pennbarry': 'PennBarry',
            'PENNBARRY': 'PennBarry',
            'PennBarry': 'PennBarry',
            'pennberry': 'PennBarry',
            
            'york': 'York',
            'YORK': 'York',
            'York': 'York',
            
            'carrier': 'Carrier',
            'CARRIER': 'Carrier',
            'Carrier': 'Carrier',
            
            'lennox': 'Lennox',
            'LENNOX': 'Lennox',
            'Lennox': 'Lennox',
            
            'rheem': 'Rheem',
            'RHEEM': 'Rheem',
            'Rheem': 'Rheem',
            
            'goodman': 'Goodman',
            'GOODMAN': 'Goodman',
            'Goodman': 'Goodman',
            
            'samsung': 'Samsung',
            'SAMSUNG': 'Samsung',
            'Samsung': 'Samsung',
            
            'lg': 'LG',
            'LG': 'LG',
            'lg electronics': 'LG Electronics',
            'LG Electronics': 'LG Electronics',
            
            'siemens': 'Siemens',
            'SIEMENS': 'Siemens',
            'Siemens': 'Siemens',
            
            'square d': 'Square D',
            'SQUARE D': 'Square D',
            'Square D': 'Square D',
            'square d by schneider electric': 'Square D by Schneider Electric',
            'Square D by Schneider Electric': 'Square D by Schneider Electric',
            
            'eaton': 'Eaton',
            'EATON': 'Eaton',
            'Eaton': 'Eaton',
            
            'abb': 'ABB',
            'ABB': 'ABB',
            'abb': 'ABB',
            
            'schneider electric': 'Schneider Electric',
            'SCHNEIDER ELECTRIC': 'Schneider Electric',
            'Schneider Electric': 'Schneider Electric',
            
            'general electric': 'General Electric',
            'GENERAL ELECTRIC': 'General Electric',
            'General Electric': 'General Electric',
            'ge': 'General Electric',
            'GE': 'General Electric',
            
            'honeywell': 'Honeywell',
            'HONEYWELL': 'Honeywell',
            'Honeywell': 'Honeywell',
            
            'johnson controls': 'Johnson Controls',
            'JOHNSON CONTROLS': 'Johnson Controls',
            'Johnson Controls': 'Johnson Controls',
            
            'emerson': 'Emerson',
            'EMERSON': 'Emerson',
            'Emerson': 'Emerson',
            
            'rockwell automation': 'Rockwell Automation',
            'ROCKWELL AUTOMATION': 'Rockwell Automation',
            'Rockwell Automation': 'Rockwell Automation',
            
            'cutler hammer': 'Cutler Hammer',
            'CUTLER HAMMER': 'Cutler Hammer',
            'Cutler Hammer': 'Cutler Hammer',
            
            'westinghouse': 'Westinghouse',
            'WESTINGHOUSE': 'Westinghouse',
            'Westinghouse': 'Westinghouse',
            
            'allen bradley': 'Allen Bradley',
            'ALLEN BRADLEY': 'Allen Bradley',
            'Allen Bradley': 'Allen Bradley',
            
            'baldor': 'Baldor',
            'BALDOR': 'Baldor',
            'Baldor': 'Baldor',
            
            'leeson': 'Leeson',
            'LEESON': 'Leeson',
            'Leeson': 'Leeson',
            
            'marathon': 'Marathon',
            'MARATHON': 'Marathon',
            'Marathon': 'Marathon',
            
            'bell & gossett': 'Bell & Gossett',
            'BELL & GOSSETT': 'Bell & Gossett',
            'Bell & Gossett': 'Bell & Gossett',
            'bell and gossett': 'Bell & Gossett',
            
            'grundfos': 'Grundfos',
            'GRUNDFOS': 'Grundfos',
            'Grundfos': 'Grundfos',
            
            'itt': 'ITT',
            'ITT': 'ITT',
            'itt': 'ITT',
            
            'flowserve': 'Flowserve',
            'FLOWSERVE': 'Flowserve',
            'Flowserve': 'Flowserve',
            
            'alfa laval': 'Alfa Laval',
            'ALFA LAVAL': 'Alfa Laval',
            'Alfa Laval': 'Alfa Laval',
            
            'markel': 'Markel',
            'MARKEL': 'Markel',
            'Markel': 'Markel',
            
            'tutco': 'Tutco',
            'TUTCO': 'Tutco',
            'Tutco': 'Tutco',
            
            'price': 'Price',
            'PRICE': 'Price',
            'Price': 'Price',
            
            'titus': 'Titus',
            'TITUS': 'Titus',
            'Titus': 'Titus',
            'titus/ price': 'Titus/Price',
            'Titus/ Price': 'Titus/Price',
            'titus/price': 'Titus/Price',
            'Titus/Price': 'Titus/Price',
            'titus - included in ao $': 'Titus',
            'Titus - included in AO $': 'Titus',
            
            'metalaire': 'Metalaire',
            'METALAIRE': 'Metalaire',
            'Metalaire': 'Metalaire',
            
            'condair': 'Condair',
            'CONDAIR': 'Condair',
            'Condair': 'Condair',
            
            'dri-steem': 'Dri-Steem',
            'DRI-STEEM': 'Dri-Steem',
            'Dri-Steem': 'Dri-Steem',
            'dristeem': 'Dri-Steem',
            'Dristeem': 'Dri-Steem',
            
            'cambridge air solutions': 'Cambridge Air Solutions',
            'CAMBRIDGE AIR SOLUTIONS': 'Cambridge Air Solutions',
            'Cambridge Air Solutions': 'Cambridge Air Solutions',
            
            'mammoth': 'Mammoth',
            'MAMMOTH': 'Mammoth',
            'Mammoth': 'Mammoth',
            
            'captiveaire': 'CaptiveAire',
            'CAPTIVEAIRE': 'CaptiveAire',
            'CaptiveAire': 'CaptiveAire',
            
            'haakon': 'Haakon',
            'HAAKON': 'Haakon',
            'Haakon': 'Haakon',
            
            'robatherm': 'Robatherm',
            'ROBATHERM': 'Robatherm',
            'Robatherm': 'Robatherm',
            
            'quantech': 'Quantech',
            'QUANTECH': 'Quantech',
            'Quantech': 'Quantech',
            
            'chillmaster': 'Chillmaster',
            'CHILLMASTER': 'Chillmaster',
            'Chillmaster': 'Chillmaster',
            'chillmaster ': 'Chillmaster',
            
            'galletti manufacturing': 'Galletti Manufacturing',
            'GALLETTI MANUFACTURING': 'Galletti Manufacturing',
            'Galletti Manufacturing': 'Galletti Manufacturing',
            
            'spx cooling tech, llc': 'SPX Cooling Tech',
            'SPX Cooling Tech, LLC': 'SPX Cooling Tech',
            'spx cooling technologies': 'SPX Cooling Tech',
            'SPX Cooling Technologies': 'SPX Cooling Tech',
            
            'marley': 'Marley',
            'MARLEY': 'Marley',
            'Marley': 'Marley',
            
            'evapco': 'Evapco',
            'EVAPCO': 'Evapco',
            'Evapco': 'Evapco',
            
            'baltimore aircoil': 'Baltimore Aircoil',
            'BALTIMORE AIRCOIL': 'Baltimore Aircoil',
            'Baltimore Aircoil': 'Baltimore Aircoil',
            
            'caterpillar': 'Caterpillar',
            'CATERPILLAR': 'Caterpillar',
            'Caterpillar': 'Caterpillar',
            
            'kohler': 'Kohler',
            'KOHLER': 'Kohler',
            'Kohler': 'Kohler',
            'kohler [rehlko]': 'Kohler',
            'Kohler [Rehlko]': 'Kohler',
            
            'generac': 'Generac',
            'GENERAC': 'Generac',
            'Generac': 'Generac',
            
            'cummins': 'Cummins',
            'CUMMINS': 'Cummins',
            'Cummins': 'Cummins',
            
            'asco': 'ASCO',
            'ASCO': 'ASCO',
            'Asco': 'ASCO',
            
            'rehlko': 'Rehlko',
            'REHLKO': 'Rehlko',
            'Rehlko': 'Rehlko',
            
            'golden anvil': 'Golden Anvil',
            'GOLDEN ANVIL': 'Golden Anvil',
            'Golden Anvil': 'Golden Anvil',
            
            'scotech': 'ScoTech',
            'SCOTECH': 'ScoTech',
            'ScoTech': 'ScoTech',
            
            'g&w electric': 'G&W Electric',
            'G&W ELECTRIC': 'G&W Electric',
            'G&W Electric': 'G&W Electric',
            
            // Special cases with complex names
            'bosch - florida heat pump': 'Bosch - Florida Heat Pump',
            'BOSCH - FLORIDA HEAT PUMP': 'Bosch - Florida Heat Pump',
            'bosch - fhp': 'Bosch - Florida Heat Pump',
            'BOSCH - FHP': 'Bosch - Florida Heat Pump',
            'bosch florida heat  pump': 'Bosch - Florida Heat Pump',
            'BOSCH FLORIDA HEAT  PUMP': 'Bosch - Florida Heat Pump',
            'fhp': 'Florida Heat Pump',
            'FHP': 'Florida Heat Pump',
            
            'water furnace': 'Water Furnace',
            'WATER FURNACE': 'Water Furnace',
            'Water Furnace': 'Water Furnace',
            
            'climate master': 'Climate Master',
            'CLIMATE MASTER': 'Climate Master',
            'Climate Master': 'Climate Master',
            
            'iec': 'IEC',
            'IEC': 'IEC',
            'iec ': 'IEC',
            'IEC ': 'IEC',
            
            'kampmann': 'Kampmann',
            'KAMPMANN': 'Kampmann',
            'Kampmann': 'Kampmann',
            
            'superior rex': 'Superior Rex',
            'SUPERIOR REX': 'Superior Rex',
            'Superior Rex': 'Superior Rex',
            
            'jaga': 'Jaga',
            'JAGA': 'Jaga',
            'Jaga': 'Jaga',
            
            'enviro tech int.': 'Enviro Tech International',
            'ENVIRO TECH INT.': 'Enviro Tech International',
            'Enviro Tech Int.': 'Enviro Tech International',
            
            'hitachi': 'Hitachi',
            'HITACHI': 'Hitachi',
            'Hitachi': 'Hitachi',
            
            'vts': 'VTS',
            'VTS': 'VTS',
            'vts': 'VTS',
            
            'tmi': 'TMI',
            'TMI': 'TMI',
            'tmi climate solutions': 'TMI Climate Solutions',
            'TMI Climate Solutions': 'TMI Climate Solutions',
            
            'cambridgeport customs': 'Cambridgeport Customs',
            'CAMBRIDGEPORT CUSTOMS': 'Cambridgeport Customs',
            'Cambridgeport Customs': 'Cambridgeport Customs',
            'cambridgport customs': 'Cambridgeport Customs',
            
            'klimor': 'Klimor',
            'KLIMOR': 'Klimor',
            'Klimor': 'Klimor',
            
            'vrv: lennox powered by samsung, doas/ahu: klimor': 'Lennox/Samsung/Klimor',
            'VRV: Lennox Powered by Samsung, DOAS/AHU: Klimor': 'Lennox/Samsung/Klimor',
            
            'nexgen': 'NexGen',
            'NEXGEN': 'NexGen',
            'NexGen': 'NexGen',
            
            'valent': 'Valent',
            'VALENT': 'Valent',
            'Valent': 'Valent',
            
            'infinity by critical systems': 'Infinity by Critical Systems',
            'INFINITY BY CRITICAL SYSTEMS': 'Infinity by Critical Systems',
            'Infinity by Critical Systems': 'Infinity by Critical Systems',
            
            'compuaire': 'CompuAire',
            'COMPUAIRE': 'CompuAire',
            'CompuAire': 'CompuAire',
            
            'magicaire': 'MagicAire',
            'MAGICAIRE': 'MagicAire',
            'MagicAire': 'MagicAire',
            
            'pottorff': 'Pottorff',
            'POTTORFF': 'Pottorff',
            'Pottorff': 'Pottorff',
            
            'arrow united': 'Arrow United',
            'ARROW UNITED': 'Arrow United',
            'Arrow United': 'Arrow United',
            
            'thermolec': 'Thermolec',
            'THERMOLEC': 'Thermolec',
            'Thermolec': 'Thermolec',
            
            'powered aire': 'Powered Aire',
            'POWERED AIRE': 'Powered Aire',
            'Powered Aire': 'Powered Aire',
            
            'plate concepts': 'Plate Concepts',
            'PLATE CONCEPTS': 'Plate Concepts',
            'Plate Concepts': 'Plate Concepts',
            'plate concepts ': 'Plate Concepts',
            
            'patterson': 'Patterson',
            'PATTERSON': 'Patterson',
            'Patterson': 'Patterson',
            'patterson ': 'Patterson',
            'patterson pumps/ abb vfds': 'Patterson',
            'Patterson Pumps/ ABB VFDs': 'Patterson',
            'patterson pumps/ abb vfds ': 'Patterson',
            'Patterson pumps/ ABB VFDs ': 'Patterson',
            
            'taco': 'Taco',
            'TACO': 'Taco',
            'Taco': 'Taco',
            
            'dunham bush usa': 'Dunham Bush USA',
            'DUNHAM BUSH USA': 'Dunham Bush USA',
            'Dunham Bush USA': 'Dunham Bush USA',
            
            'daikin/mcquay': 'Daikin/McQuay',
            'DAIKIN/MCQUAY': 'Daikin/McQuay',
            'Daikin/McQuay': 'Daikin/McQuay',
            
            'mcquay': 'McQuay',
            'MCQUAY': 'McQuay',
            'McQuay': 'McQuay',
            
            'aerco': 'Aerco',
            'AERCO': 'Aerco',
            'Aerco': 'Aerco',
            
            'neptronic': 'Neptronic',
            'NEPTRONIC': 'Neptronic',
            'Neptronic': 'Neptronic',
            
            'trion': 'Trion',
            'TRION': 'Trion',
            'Trion': 'Trion',
            
            // Handle "None" and empty entries
            'none': '',
            'None': '',
            'NONE': '',
            '': '',
            'null': '',
            'NULL': '',
            'undefined': ''
        };

        // Add all mappings to the map
        for (const [key, value] of Object.entries(mappings)) {
            this.standardizationMap.set(key, value);
        }
    }

    standardizeManufacturer(manufacturer) {
        if (!manufacturer || typeof manufacturer !== 'string') {
            return '';
        }

        // Trim whitespace
        let cleaned = manufacturer.trim();
        
        // Check exact match first
        if (this.standardizationMap.has(cleaned)) {
            return this.standardizationMap.get(cleaned);
        }

        // Try case-insensitive lookup
        const lowerCleaned = cleaned.toLowerCase();
        for (const [key, value] of this.standardizationMap.entries()) {
            if (key.toLowerCase() === lowerCleaned) {
                return value;
            }
        }

        // If no exact match, try basic cleanup
        // Remove extra whitespace and standardize case
        cleaned = cleaned
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .trim();

        // Basic case standardization for unmatched items
        if (cleaned === cleaned.toUpperCase() && cleaned.length > 2) {
            // If all caps, convert to title case
            cleaned = cleaned
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        }

        return cleaned;
    }

    async loadAndCleanData() {
        console.log('Loading and cleaning manufacturer data...');
        
        const data = [];
        const originalManufacturers = new Set();
        const cleanedManufacturers = new Set();
        
        // Read the CSV file
        return new Promise((resolve, reject) => {
            fs.createReadStream('Package_Quote_Details.csv')
                .pipe(csv())
                .on('data', (row) => {
                    try {
                        // Parse the manufacturer JSON array
                        const manufacturerArray = JSON.parse(row.manufacturer || '[]');
                        
                        // Track original manufacturers
                        manufacturerArray.forEach(mfg => originalManufacturers.add(mfg));
                        
                        // Clean each manufacturer
                        const cleanedManufacturerArray = manufacturerArray
                            .map(mfg => this.standardizeManufacturer(mfg))
                            .filter(mfg => mfg && mfg.trim().length > 0); // Remove empty entries
                        
                        // Track cleaned manufacturers
                        cleanedManufacturerArray.forEach(mfg => cleanedManufacturers.add(mfg));
                        
                        // Update the row with cleaned manufacturers
                        row.manufacturer = JSON.stringify(cleanedManufacturerArray);
                        
                        data.push(row);
                    } catch (error) {
                        console.error('Error processing row:', error);
                        // Keep original row if parsing fails
                        data.push(row);
                    }
                })
                .on('end', () => {
                    this.cleanedData = data;
                    
                    console.log(`\nManufacturer standardization complete:`);
                    console.log(`• Original unique manufacturers: ${originalManufacturers.size}`);
                    console.log(`• Cleaned unique manufacturers: ${cleanedManufacturers.size}`);
                    console.log(`• Reduction: ${originalManufacturers.size - cleanedManufacturers.size} manufacturers consolidated`);
                    
                    resolve();
                })
                .on('error', reject);
        });
    }

    async saveCleanedData() {
        console.log('Saving cleaned data to Package_Quote_Details.csv...');
        
        if (this.cleanedData.length === 0) {
            throw new Error('No cleaned data to save');
        }

        // Get headers from the first row
        const headers = Object.keys(this.cleanedData[0]);
        
        // Create CSV writer
        const csvWriter = createCsvWriter({
            path: 'Package_Quote_Details.csv',
            header: headers.map(h => ({ id: h, title: h }))
        });

        await csvWriter.writeRecords(this.cleanedData);
        console.log('✓ Cleaned data saved successfully');
    }

    async standardizeManufacturers() {
        console.log('Starting manufacturer standardization...\n');
        
        try {
            await this.loadAndCleanData();
            await this.saveCleanedData();
            
            console.log('\n' + '='.repeat(60));
            console.log('MANUFACTURER STANDARDIZATION COMPLETE!');
            console.log('='.repeat(60));
            console.log('✓ Package_Quote_Details.csv has been updated with standardized manufacturer names');
            console.log('✓ Ready to run historical lead time analysis');
            
            return true;
        } catch (error) {
            console.error('Error during standardization:', error);
            return false;
        }
    }
}

// Export for use in other modules
module.exports = ManufacturerStandardizer;

// Run if called directly
if (require.main === module) {
    const standardizer = new ManufacturerStandardizer();
    standardizer.standardizeManufacturers().catch(console.error);
}
