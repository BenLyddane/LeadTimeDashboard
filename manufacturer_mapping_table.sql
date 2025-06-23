-- Create a manufacturer mapping table for scalable standardization

CREATE TABLE IF NOT EXISTS manufacturer_mapping (
  id SERIAL PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  standardized_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  notes TEXT
);

-- Create unique index on original name (case insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_manufacturer_mapping_original 
ON manufacturer_mapping (LOWER(original_name));

-- Insert your current standardization mappings
INSERT INTO manufacturer_mapping (original_name, standardized_name, notes) VALUES
('aaon', 'AAON', 'Case standardization'),
('AAON', 'AAON', 'Already correct'),
('Aaon', 'AAON', 'Case standardization'),
('stulz', 'Stulz', 'Case standardization'),
('STULZ', 'Stulz', 'Case standardization'),
('vertiv', 'Vertiv', 'Case standardization'),
('VERTIV', 'Vertiv', 'Case standardization'),
('mitusbishi', 'Mitsubishi', 'Spelling correction'),
('Mitusbishi', 'Mitsubishi', 'Spelling correction'),
('above air ', 'Above Air', 'Whitespace cleanup'),
('twin city fan/ abb vfds', 'Twin City Fan', 'Remove VFD reference'),
('Twin City Fan/ ABB VFDs', 'Twin City Fan', 'Remove VFD reference'),
('twin city fan/ abb vfds ', 'Twin City Fan', 'Remove VFD reference'),
('Twin City Fan/ ABB VFDs ', 'Twin City Fan', 'Remove VFD reference'),
('twin city fans & abb vfds', 'Twin City Fan', 'Remove VFD reference'),
('Twin City Fans & ABB VFDS', 'Twin City Fan', 'Remove VFD reference'),
('twin city fan/ abb', 'Twin City Fan', 'Remove VFD reference'),
('Twin City Fan/ ABB', 'Twin City Fan', 'Remove VFD reference'),
('twin city', 'Twin City Fan', 'Add Fan suffix'),
('Twin City', 'Twin City Fan', 'Add Fan suffix'),
('twin city fans', 'Twin City Fan', 'Standardize to singular'),
('Twin City Fans', 'Twin City Fan', 'Standardize to singular'),
('twin city fan ', 'Twin City Fan', 'Whitespace cleanup'),
('Twin City Fan ', 'Twin City Fan', 'Whitespace cleanup'),
('twin cIty', 'Twin City Fan', 'Case and suffix correction'),
('Twin CIty', 'Twin City Fan', 'Case and suffix correction'),
('greenheck fans & franklin controls starters', 'Greenheck', 'Remove accessories'),
('GREENHECK FANS & FRANKLIN CONTROLS STARTERS', 'Greenheck', 'Remove accessories'),
('loren cook', 'Loren Cook', 'Case standardization'),
('LOREN COOK', 'Loren Cook', 'Case standardization'),
('cook', 'Loren Cook', 'Add first name'),
('COOK', 'Loren Cook', 'Add first name'),
('Cook', 'Loren Cook', 'Add first name'),
('indeeco', 'Indeeco', 'Case standardization'),
('INDEECO', 'Indeeco', 'Case standardization'),
('indeeco ', 'Indeeco', 'Whitespace cleanup'),
('anemostat', 'Anemostat', 'Case standardization'),
('ANEMOSTAT', 'Anemostat', 'Case standardization'),
('pennbarry', 'PennBarry', 'Case standardization'),
('PENNBARRY', 'PennBarry', 'Case standardization'),
('pennberry', 'PennBarry', 'Spelling correction'),
('armstrong', 'Armstrong', 'Case standardization'),
('ARMSTRONG', 'Armstrong', 'Case standardization'),
('armstrong fluid technology', 'Armstrong Fluid Technology', 'Full name'),
('Armstrong Fluid Technology', 'Armstrong Fluid Technology', 'Already correct'),
('trane', 'Trane', 'Case standardization'),
('TRANE', 'Trane', 'Case standardization'),
('daikin', 'Daikin', 'Case standardization'),
('DAIKIN', 'Daikin', 'Case standardization'),
('daikin applied', 'Daikin Applied', 'Full name'),
('Daikin Applied', 'Daikin Applied', 'Already correct'),
('DAIKIN APPLIED', 'Daikin Applied', 'Case standardization'),
('mitsubishi', 'Mitsubishi', 'Case standardization'),
('MITSUBISHI', 'Mitsubishi', 'Case standardization'),
('trane-mitsubishi', 'Trane-Mitsubishi', 'Compound name'),
('Trane-Mitsubishi', 'Trane-Mitsubishi', 'Already correct'),
('trane/mitsubishi', 'Trane/Mitsubishi', 'Compound name'),
('Trane/Mitsubishi', 'Trane/Mitsubishi', 'Already correct')
ON CONFLICT (LOWER(original_name)) DO NOTHING;

-- Function to standardize using the mapping table with fallback
CREATE OR REPLACE FUNCTION standardize_manufacturer_with_mapping(input_manufacturer TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Handle null/empty values
  IF input_manufacturer IS NULL OR trim(input_manufacturer) = '' THEN
    RETURN '';
  END IF;

  -- Trim whitespace first
  input_manufacturer := trim(input_manufacturer);

  -- Look up in mapping table (case insensitive)
  SELECT standardized_name INTO result 
  FROM manufacturer_mapping 
  WHERE LOWER(original_name) = LOWER(input_manufacturer);

  -- If found in mapping table, return standardized name
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Fallback: Apply basic normalization for unknown manufacturers
  -- Remove extra whitespace
  result := regexp_replace(input_manufacturer, '\s+', ' ', 'g');
  
  -- If all caps and longer than 2 chars, convert to title case
  IF result = upper(result) AND length(result) > 2 THEN
    result := initcap(lower(result));
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Query to find unmapped manufacturers in your current data
SELECT 
  unnest(manufacturer) as unmapped_manufacturer,
  COUNT(*) as usage_count
FROM (
  -- Your ComponentTypeLeadTimesExpanded CTE result here
  SELECT manufacturer FROM ComponentTypeLeadTimesExpanded
) subquery
WHERE lower(trim(unnest(manufacturer))) NOT IN (
  SELECT lower(original_name) FROM manufacturer_mapping
)
AND trim(unnest(manufacturer)) != ''
GROUP BY unnest(manufacturer)
ORDER BY usage_count DESC;
