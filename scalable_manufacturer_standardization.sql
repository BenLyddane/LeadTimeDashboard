-- Scalable Manufacturer Standardization for Retool
-- Handles both known manufacturers (with specific mappings) and unknown manufacturers (with basic cleanup)

CREATE OR REPLACE FUNCTION standardize_manufacturer(input_manufacturer TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Handle null/empty values
  IF input_manufacturer IS NULL OR trim(input_manufacturer) = '' THEN
    RETURN '';
  END IF;

  -- Trim whitespace first
  input_manufacturer := trim(input_manufacturer);

  -- Apply specific standardization mappings for known manufacturers
  RETURN 
    CASE 
      -- AAON variations
      WHEN lower(input_manufacturer) IN ('aaon', 'Aaon') THEN 'AAON'
      
      -- Stulz variations
      WHEN lower(input_manufacturer) IN ('stulz', 'STULZ') THEN 'Stulz'
      
      -- Vertiv variations
      WHEN lower(input_manufacturer) IN ('vertiv', 'VERTIV') THEN 'Vertiv'
      
      -- Trane variations
      WHEN lower(input_manufacturer) IN ('trane', 'TRANE') THEN 'Trane'
      
      -- Daikin variations
      WHEN lower(input_manufacturer) IN ('daikin', 'DAIKIN') THEN 'Daikin'
      WHEN lower(input_manufacturer) IN ('daikin applied', 'DAIKIN APPLIED') THEN 'Daikin Applied'
      
      -- Mitsubishi variations (including spelling errors)
      WHEN lower(input_manufacturer) IN ('mitsubishi', 'MITSUBISHI', 'mitusbishi', 'Mitusbishi') THEN 'Mitsubishi'
      WHEN lower(input_manufacturer) IN ('trane-mitsubishi', 'Trane-Mitsubishi') THEN 'Trane-Mitsubishi'
      WHEN lower(input_manufacturer) IN ('trane/mitsubishi', 'Trane/Mitsubishi') THEN 'Trane/Mitsubishi'
      
      -- Armstrong variations
      WHEN lower(input_manufacturer) IN ('armstrong', 'ARMSTRONG') THEN 'Armstrong'
      WHEN lower(input_manufacturer) IN ('armstrong fluid technology') THEN 'Armstrong Fluid Technology'
      
      -- Above Air variations
      WHEN lower(input_manufacturer) IN ('above air', 'ABOVE AIR', 'above air ', 'Above-Air') THEN 'Above Air'
      
      -- Krueger variations
      WHEN lower(input_manufacturer) IN ('krueger', 'KRUEGER', 'krueger ') THEN 'Krueger'
      
      -- Twin City Fan variations (including complex variations with VFDs)
      WHEN lower(input_manufacturer) IN ('twin city', 'twin city fan', 'twin city fans', 'twin cIty', 'twin city fan ') THEN 'Twin City Fan'
      WHEN lower(input_manufacturer) LIKE '%twin city fan%abb%vfd%' THEN 'Twin City Fan'
      WHEN lower(input_manufacturer) LIKE '%twin city%abb%' THEN 'Twin City Fan'
      
      -- Greenheck variations
      WHEN lower(input_manufacturer) IN ('greenheck', 'GREENHECK') THEN 'Greenheck'
      WHEN lower(input_manufacturer) LIKE '%greenheck%franklin%controls%' THEN 'Greenheck'
      
      -- Loren Cook variations
      WHEN lower(input_manufacturer) IN ('loren cook', 'LOREN COOK', 'cook', 'COOK') THEN 'Loren Cook'
      
      -- Add more known manufacturer mappings here...
      
      -- Fallback: Apply basic normalization for unknown manufacturers
      ELSE 
        CASE 
          -- If all caps and longer than 2 chars, convert to title case
          WHEN input_manufacturer = upper(input_manufacturer) AND length(input_manufacturer) > 2 THEN
            initcap(lower(input_manufacturer))
          
          -- Remove extra whitespace
          ELSE regexp_replace(input_manufacturer, '\s+', ' ', 'g')
        END
    END;
END;
$$ LANGUAGE plpgsql;

-- Usage example in your main query:
-- SELECT standardize_manufacturer(manufacturer) as clean_manufacturer FROM your_table;
