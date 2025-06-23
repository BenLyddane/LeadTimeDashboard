# Retool Historical Lead Time Dashboard Setup Guide

This guide will help you create the complete historical lead time dashboard in Retool using your production database.

## 1. Create New Retool App

1. Create new app: "Historical Lead Time Dashboard"
2. Add your PostgreSQL database as a resource

## 2. Setup Database Queries

### Main Query: `getLeadTimeData`
```sql
-- Copy the entire content from retool_dashboard_final.sql
-- This query handles all views and includes manufacturer standardization
```

### Filter Queries

#### Query: `getComponentTypes`
```sql
WITH ComponentTypeLeadTimesExpanded as (
  -- Your main CTE from the main query above
)
SELECT DISTINCT 
  unnest(component_types) as component_type,
  count(*) as usage_count
FROM ComponentTypeLeadTimesExpanded
GROUP BY unnest(component_types)
ORDER BY count(*) DESC;
```

#### Query: `getManufacturers`
```sql
WITH ComponentTypeLeadTimesExpanded as (
  -- Your main CTE from the main query above  
)
SELECT DISTINCT 
  unnest(manufacturer) as manufacturer_name,
  count(*) as usage_count
FROM ComponentTypeLeadTimesExpanded
GROUP BY unnest(manufacturer)
ORDER BY count(*) DESC;
```

## 3. Create Components Layout

### Top Section: Controls & Stats
```
+------------------------------------------------------------------+
|  [Component Filter ▼] [Manufacturer Filter ▼] [Date From] [Date To] |
|  [Component Trends] [Manufacturer Trends] [Single Analysis] [Heatmap] |
+------------------------------------------------------------------+
|   📊 [Total Quotes]   📅 [Months]   🔧 [Components]  🏭 [Manufacturers] |
+------------------------------------------------------------------+
```

### Main Section: Chart Area
```
+------------------------------------------------------------------+
|                                                                  |
|                     Main Chart Area                             |
|                     (Line Chart Component)                      |
|                                                                  |
|                                                                  |
+------------------------------------------------------------------+
```

### Bottom Section: Secondary Chart
```
+------------------------------------------------------------------+
|                   Secondary Analysis Chart                      |
|                   (for drill-down views)                        |
+------------------------------------------------------------------+
```

## 4. Component Configuration

### A. Filter Components

#### componentTypeSelect (Select Component)
- **Label**: "Component Type"
- **Data Source**: `getComponentTypes.data`
- **Option Label**: `{{ item.component_type }}`
- **Option Value**: `{{ item.component_type }}`
- **Default Value**: `""`
- **Allow Clear**: `true`
- **Placeholder**: "All Component Types"

#### manufacturerSelect (Select Component)
- **Label**: "Manufacturer"
- **Data Source**: `getManufacturers.data`
- **Option Label**: `{{ item.manufacturer_name }}`
- **Option Value**: `{{ item.manufacturer_name }}`
- **Default Value**: `""`
- **Allow Clear**: `true`
- **Placeholder**: "All Manufacturers"

#### dateFromPicker (Date Component)
- **Label**: "From Date"
- **Default Value**: `moment().subtract(12, 'months').format('YYYY-MM-DD')`

#### dateToPicker (Date Component)
- **Label**: "To Date"  
- **Default Value**: `moment().format('YYYY-MM-DD')`

### B. View Toggle Buttons

#### componentTrendsBtn (Button Component)
- **Text**: "Component Trends"
- **Style**: `{{ viewTypeState.value === 'componentTimeSeries' ? 'solid' : 'outline' }}`
- **On Click**: `viewTypeState.setValue('componentTimeSeries'); getLeadTimeData.trigger();`

#### manufacturerTrendsBtn (Button Component)
- **Text**: "Manufacturer Trends"
- **Style**: `{{ viewTypeState.value === 'manufacturerTimeSeries' ? 'solid' : 'outline' }}`
- **On Click**: `viewTypeState.setValue('manufacturerTimeSeries'); getLeadTimeData.trigger();`

#### singleAnalysisBtn (Button Component)
- **Text**: "Single Analysis"
- **Style**: `{{ viewTypeState.value === 'rawData' ? 'solid' : 'outline' }}`
- **On Click**: `viewTypeState.setValue('rawData'); getLeadTimeData.trigger();`

#### heatmapBtn (Button Component)
- **Text**: "Heatmap"
- **Style**: `{{ viewTypeState.value === 'heatmap' ? 'solid' : 'outline' }}`
- **On Click**: `viewTypeState.setValue('heatmap'); getLeadTimeData.trigger();`

### C. Stats Cards

#### totalQuotesCard (Stat Component)
- **Primary Value**: `{{ summaryStats.value?.total_quotes || 0 }}`
- **Label**: "Total Quotes"
- **Icon**: "📊"

#### totalMonthsCard (Stat Component)
- **Primary Value**: `{{ summaryStats.value?.total_months || 0 }}`
- **Label**: "Months of Data"
- **Icon**: "📅"

#### totalComponentsCard (Stat Component)
- **Primary Value**: `{{ summaryStats.value?.total_components || 0 }}`
- **Label**: "Component Types"
- **Icon**: "🔧"

#### totalManufacturersCard (Stat Component)
- **Primary Value**: `{{ summaryStats.value?.total_manufacturers || 0 }}`
- **Label**: "Manufacturers"
- **Icon**: "🏭"

### D. Main Chart

#### mainChart (Chart Component)
- **Chart Type**: Line Chart
- **Data Source**: `chartData.value`
- **X-Axis**: `{{ item.month_key }}`
- **Y-Axis**: `{{ item.avg_lead_time }}`
- **Group By**: `{{ item.series_name }}`
- **X-Axis Label**: "Month"
- **Y-Axis Label**: "Average Lead Time (weeks)"
- **Show Legend**: `true`
- **Show Tooltips**: `true`

## 5. JavaScript Transformers

### State Management

#### viewTypeState (State Component)
- **Initial Value**: `"componentTimeSeries"`

#### currentFilters (State Component)
- **Initial Value**: 
```javascript
{
  componentType: "",
  manufacturer: "", 
  dateFrom: moment().subtract(12, 'months').format('YYYY-MM-DD'),
  dateTo: moment().format('YYYY-MM-DD')
}
```

### Data Transformers

#### summaryStats (JavaScript Query)
```javascript
// Get summary statistics
const summaryQuery = getLeadTimeData.trigger({
  additionalScope: {
    viewType: 'summaryStats',
    componentTypeFilter: '',
    manufacturerFilter: '',
    dateFromFilter: null,
    dateToFilter: null
  }
});

return summaryQuery;
```

#### chartData (JavaScript Query)
```javascript
const viewType = viewTypeState.value;
const data = getLeadTimeData.data;

if (!data || data.length === 0) return [];

switch(viewType) {
  case 'componentTimeSeries':
    // Transform component time series data
    const componentData = data
      .filter(row => row.component_series_data)
      .map(row => JSON.parse(row.component_series_data));
    
    // Group by component type and create series
    const componentSeries = {};
    componentData.forEach(item => {
      if (!componentSeries[item.component_type]) {
        componentSeries[item.component_type] = [];
      }
      componentSeries[item.component_type].push({
        month_key: item.month_key,
        avg_lead_time: item.avg_lead_time,
        data_points: item.data_points,
        series_name: item.component_type
      });
    });
    
    // Flatten for chart and limit to top 8 components
    const topComponents = Object.keys(componentSeries)
      .sort((a, b) => componentSeries[b].length - componentSeries[a].length)
      .slice(0, 8);
    
    return topComponents.flatMap(component => 
      componentSeries[component].map(point => ({
        ...point,
        series_name: component.length > 30 ? component.substring(0, 30) + '...' : component
      }))
    );

  case 'manufacturerTimeSeries':
    // Transform manufacturer time series data
    const manufacturerData = data
      .filter(row => row.manufacturer_series_data)
      .map(row => JSON.parse(row.manufacturer_series_data));
    
    // Group by manufacturer and create series
    const manufacturerSeries = {};
    manufacturerData.forEach(item => {
      if (!manufacturerSeries[item.manufacturer_name]) {
        manufacturerSeries[item.manufacturer_name] = [];
      }
      manufacturerSeries[item.manufacturer_name].push({
        month_key: item.month_key,
        avg_lead_time: item.avg_lead_time,
        data_points: item.data_points,
        series_name: item.manufacturer_name
      });
    });
    
    // Flatten for chart and limit to top 8 manufacturers
    const topManufacturers = Object.keys(manufacturerSeries)
      .sort((a, b) => manufacturerSeries[b].length - manufacturerSeries[a].length)
      .slice(0, 8);
    
    return topManufacturers.flatMap(manufacturer => 
      manufacturerSeries[manufacturer].map(point => ({
        ...point,
        series_name: manufacturer
      }))
    );

  case 'overallTimeSeries':
    // Transform overall time series data
    return data
      .filter(row => row.overall_series_data)
      .map(row => {
        const item = JSON.parse(row.overall_series_data);
        return {
          month_key: item.month_key,
          avg_lead_time: item.avg_lead_time,
          data_points: item.data_points,
          series_name: 'Overall Average'
        };
      });

  default:
    return [];
}
```

#### heatmapData (JavaScript Query)
```javascript
// Transform data for heatmap visualization
const data = getLeadTimeData.data;

if (!data || viewTypeState.value !== 'heatmap') return [];

const componentData = data
  .filter(row => row.component_series_data)
  .map(row => JSON.parse(row.component_series_data));

// Create heatmap matrix
const components = [...new Set(componentData.map(item => item.component_type))];
const months = [...new Set(componentData.map(item => item.month_key))].sort();

const heatmapMatrix = components.slice(0, 15).map(component => {
  return months.map(month => {
    const dataPoint = componentData.find(
      item => item.component_type === component && item.month_key === month
    );
    return {
      x: month,
      y: component.length > 25 ? component.substring(0, 25) + '...' : component,
      z: dataPoint ? dataPoint.avg_lead_time : null
    };
  });
}).flat();

return heatmapMatrix;
```

## 6. Event Handlers

### Filter Change Events

#### On componentTypeSelect Change:
```javascript
currentFilters.setValue({
  ...currentFilters.value,
  componentType: componentTypeSelect.value || ""
});

getLeadTimeData.trigger({
  additionalScope: {
    componentTypeFilter: componentTypeSelect.value || "",
    manufacturerFilter: manufacturerSelect.value || "",
    dateFromFilter: dateFromPicker.value,
    dateToFilter: dateToPicker.value,
    viewType: viewTypeState.value
  }
});
```

#### On manufacturerSelect Change:
```javascript
currentFilters.setValue({
  ...currentFilters.value,
  manufacturer: manufacturerSelect.value || ""
});

getLeadTimeData.trigger({
  additionalScope: {
    componentTypeFilter: componentTypeSelect.value || "",
    manufacturerFilter: manufacturerSelect.value || "",
    dateFromFilter: dateFromPicker.value,
    dateToFilter: dateToPicker.value,
    viewType: viewTypeState.value
  }
});
```

#### On Date Change:
```javascript
currentFilters.setValue({
  ...currentFilters.value,
  dateFrom: dateFromPicker.value,
  dateTo: dateToPicker.value
});

getLeadTimeData.trigger({
  additionalScope: {
    componentTypeFilter: componentTypeSelect.value || "",
    manufacturerFilter: manufacturerSelect.value || "",
    dateFromFilter: dateFromPicker.value,
    dateToFilter: dateToPicker.value,
    viewType: viewTypeState.value
  }
});
```

## 7. Heatmap Setup (Optional Advanced Feature)

If you want the heatmap view, add a Chart component with:
- **Chart Type**: Heatmap
- **Data Source**: `heatmapData.value`
- **X-Axis**: `{{ item.x }}`
- **Y-Axis**: `{{ item.y }}`
- **Color**: `{{ item.z }}`
- **Show when**: `{{ viewTypeState.value === 'heatmap' }}`

## 8. Styling & Layout

### CSS for consistent spacing:
```css
.dashboard-header {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.chart-container {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 24px;
}
```

## 9. Testing & Deployment

1. **Test Filters**: Verify all filter combinations work
2. **Test Views**: Check all view types (component trends, manufacturer trends, etc.)
3. **Test Performance**: Ensure queries run efficiently with your data volume
4. **Set Permissions**: Configure who can access the dashboard
5. **Deploy**: Publish the app for your team

This setup replicates all functionality from your current HTML dashboard while being directly connected to your production database with automatic manufacturer standardization!
