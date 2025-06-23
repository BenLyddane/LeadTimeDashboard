# Build Your Historical Lead Time Dashboard in Retool

Based on your existing dashboard, here's how to recreate it exactly in Retool using your SQL data.

## Step 1: Create the Main Query

1. **Create Query**: Name it `getLeadTimeData`
2. **Copy SQL**: Use your `retool_dashboard_simple.sql`
3. **Test**: Run it to confirm you get the CSV-like data

## Step 2: Create JavaScript Transformers

### A. Data Processing Transformer: `processedData`
```javascript
// Process the raw SQL data into time series format
const rawData = getLeadTimeData.data || [];

// Group by month and process
const monthlyData = {};
const allMonths = new Set();
const allComponents = new Set();
const allManufacturers = new Set();

rawData.forEach(row => {
  const month = row.month_key;
  allMonths.add(month);
  
  // Parse component types and manufacturers from arrays
  let componentTypes = [];
  let manufacturers = [];
  
  try {
    componentTypes = typeof row.component_types === 'string' 
      ? JSON.parse(row.component_types) 
      : row.component_types || [];
    manufacturers = typeof row.manufacturer === 'string' 
      ? JSON.parse(row.manufacturer) 
      : row.manufacturer || [];
  } catch (e) {
    componentTypes = [row.component_types].filter(Boolean);
    manufacturers = [row.manufacturer].filter(Boolean);
  }
  
  // Create entry for each component-manufacturer combination
  componentTypes.forEach(component => {
    allComponents.add(component);
    manufacturers.forEach(manufacturer => {
      allManufacturers.add(manufacturer);
      
      if (!monthlyData[month]) monthlyData[month] = [];
      monthlyData[month].push({
        month,
        componentType: component,
        manufacturer,
        leadTime: parseFloat(row.lead_time_weeks) || 0,
        cost: parseFloat(row.cost) || 0,
        projectName: row.project_name,
        buyerName: row.buyer_name,
        sellerName: row.seller_name
      });
    });
  });
});

return {
  monthlyData,
  sortedMonths: Array.from(allMonths).sort(),
  allComponents: Array.from(allComponents).sort(),
  allManufacturers: Array.from(allManufacturers).sort(),
  totalQuotes: rawData.length
};
```

### B. Component Time Series Transformer: `componentTimeSeriesData`
```javascript
const { monthlyData, sortedMonths, allComponents } = processedData.value;

// Calculate component time series
const componentTimeSeries = {};

allComponents.forEach(component => {
  const monthlyStats = {};
  
  sortedMonths.forEach(month => {
    const monthData = monthlyData[month] || [];
    const componentData = monthData.filter(d => d.componentType === component);
    
    if (componentData.length > 0) {
      const leadTimes = componentData.map(d => d.leadTime);
      const avgLeadTime = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
      const sortedTimes = [...leadTimes].sort((a, b) => a - b);
      const median = sortedTimes.length % 2 === 0 
        ? (sortedTimes[Math.floor(sortedTimes.length / 2) - 1] + sortedTimes[Math.floor(sortedTimes.length / 2)]) / 2
        : sortedTimes[Math.floor(sortedTimes.length / 2)];
      
      monthlyStats[month] = {
        avgLeadTime: Math.round(avgLeadTime * 10) / 10,
        medianLeadTime: Math.round(median * 10) / 10,
        minLeadTime: Math.min(...leadTimes),
        maxLeadTime: Math.max(...leadTimes),
        dataPoints: leadTimes.length,
        totalCost: componentData.reduce((sum, d) => sum + d.cost, 0)
      };
    }
  });
  
  // Only include components with sufficient data
  const totalDataPoints = Object.values(monthlyStats).reduce((sum, stats) => sum + stats.dataPoints, 0);
  if (totalDataPoints >= 5) {
    componentTimeSeries[component] = monthlyStats;
  }
});

return componentTimeSeries;
```

### C. Manufacturer Time Series Transformer: `manufacturerTimeSeriesData`
```javascript
const { monthlyData, sortedMonths, allManufacturers } = processedData.value;

// Calculate manufacturer time series
const manufacturerTimeSeries = {};

allManufacturers.forEach(manufacturer => {
  const monthlyStats = {};
  
  sortedMonths.forEach(month => {
    const monthData = monthlyData[month] || [];
    const manufacturerData = monthData.filter(d => d.manufacturer === manufacturer);
    
    if (manufacturerData.length > 0) {
      const leadTimes = manufacturerData.map(d => d.leadTime);
      const avgLeadTime = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
      const sortedTimes = [...leadTimes].sort((a, b) => a - b);
      const median = sortedTimes.length % 2 === 0 
        ? (sortedTimes[Math.floor(sortedTimes.length / 2) - 1] + sortedTimes[Math.floor(sortedTimes.length / 2)]) / 2
        : sortedTimes[Math.floor(sortedTimes.length / 2)];
      
      monthlyStats[month] = {
        avgLeadTime: Math.round(avgLeadTime * 10) / 10,
        medianLeadTime: Math.round(median * 10) / 10,
        minLeadTime: Math.min(...leadTimes),
        maxLeadTime: Math.max(...leadTimes),
        dataPoints: leadTimes.length,
        totalCost: manufacturerData.reduce((sum, d) => sum + d.cost, 0),
        componentTypes: [...new Set(manufacturerData.map(d => d.componentType))]
      };
    }
  });
  
  // Only include manufacturers with sufficient data
  const totalDataPoints = Object.values(monthlyStats).reduce((sum, stats) => sum + stats.dataPoints, 0);
  if (totalDataPoints >= 5) {
    manufacturerTimeSeries[manufacturer] = monthlyStats;
  }
});

return manufacturerTimeSeries;
```

### D. Chart Data Transformer: `chartData`
```javascript
const viewType = viewTypeState.value || 'componentTrends';
const { sortedMonths } = processedData.value;
const componentData = componentTimeSeriesData.value;
const manufacturerData = manufacturerTimeSeriesData.value;

switch(viewType) {
  case 'componentTrends':
    // Top 8 components by data volume
    const topComponents = Object.keys(componentData)
      .map(component => ({
        component,
        totalData: Object.values(componentData[component]).reduce((sum, stats) => sum + stats.dataPoints, 0)
      }))
      .sort((a, b) => b.totalData - a.totalData)
      .slice(0, 8)
      .map(item => item.component);
    
    return topComponents.map(component => ({
      name: component.length > 30 ? component.substring(0, 30) + '...' : component,
      x: sortedMonths,
      y: sortedMonths.map(month => {
        const stats = componentData[component][month];
        return stats ? stats.avgLeadTime : null;
      }),
      type: 'scatter',
      mode: 'lines+markers',
      connectgaps: false
    }));
    
  case 'manufacturerTrends':
    // Top 8 manufacturers by data volume
    const topManufacturers = Object.keys(manufacturerData)
      .map(manufacturer => ({
        manufacturer,
        totalData: Object.values(manufacturerData[manufacturer]).reduce((sum, stats) => sum + stats.dataPoints, 0)
      }))
      .sort((a, b) => b.totalData - a.totalData)
      .slice(0, 8)
      .map(item => item.manufacturer);
    
    return topManufacturers.map(manufacturer => ({
      name: manufacturer,
      x: sortedMonths,
      y: sortedMonths.map(month => {
        const stats = manufacturerData[manufacturer][month];
        return stats ? stats.avgLeadTime : null;
      }),
      type: 'scatter',
      mode: 'lines+markers',
      connectgaps: false
    }));
    
  case 'singleComponent':
    const selectedComponent = componentSelector.value;
    if (!selectedComponent || !componentData[selectedComponent]) return [];
    
    const componentStats = componentData[selectedComponent];
    return [
      {
        name: 'Average Lead Time',
        x: sortedMonths,
        y: sortedMonths.map(month => {
          const stats = componentStats[month];
          return stats ? stats.avgLeadTime : null;
        }),
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: 'y',
        line: { width: 3, color: '#1976d2' }
      },
      {
        name: 'Data Points',
        x: sortedMonths,
        y: sortedMonths.map(month => {
          const stats = componentStats[month];
          return stats ? stats.dataPoints : 0;
        }),
        type: 'bar',
        yaxis: 'y2',
        marker: { color: 'rgba(255, 99, 132, 0.6)' }
      }
    ];
    
  case 'overallTrend':
    // Calculate overall monthly averages
    const { monthlyData } = processedData.value;
    const overallData = sortedMonths.map(month => {
      const monthData = monthlyData[month] || [];
      if (monthData.length === 0) return null;
      
      const avgLeadTime = monthData.reduce((sum, d) => sum + d.leadTime, 0) / monthData.length;
      return avgLeadTime;
    });
    
    return [{
      name: 'Overall Average',
      x: sortedMonths,
      y: overallData,
      type: 'scatter',
      mode: 'lines+markers',
      line: { width: 3, color: '#1976d2' },
      marker: { size: 8 }
    }];
    
  case 'heatmap':
    // Create heatmap data
    const topComponentsForHeatmap = Object.keys(componentData)
      .slice(0, 15);
    
    const heatmapZ = topComponentsForHeatmap.map(component => 
      sortedMonths.map(month => {
        const stats = componentData[component][month];
        return stats ? stats.avgLeadTime : null;
      })
    );
    
    return [{
      z: heatmapZ,
      x: sortedMonths,
      y: topComponentsForHeatmap.map(c => c.length > 25 ? c.substring(0, 25) + '...' : c),
      type: 'heatmap',
      colorscale: 'RdYlBu_r',
      showscale: true
    }];
    
  default:
    return [];
}
```

## Step 3: Create Components

### A. State Components
1. **viewTypeState**: Initial value `"componentTrends"`

### B. Summary Stats (4 Stat Components)
```javascript
// totalQuotesCard
{{ processedData.value?.totalQuotes || 0 }}

// totalMonthsCard  
{{ processedData.value?.sortedMonths?.length || 0 }}

// totalComponentsCard
{{ Object.keys(componentTimeSeriesData.value || {}).length }}

// totalManufacturersCard
{{ Object.keys(manufacturerTimeSeriesData.value || {}).length }}
```

### C. View Toggle Buttons
```javascript
// componentTrendsBtn - On Click:
viewTypeState.setValue('componentTrends');

// manufacturerTrendsBtn - On Click:
viewTypeState.setValue('manufacturerTrends');

// singleComponentBtn - On Click:
viewTypeState.setValue('singleComponent');

// heatmapBtn - On Click:
viewTypeState.setValue('heatmap');

// overallTrendBtn - On Click:
viewTypeState.setValue('overallTrend');
```

### D. Dropdown Selectors
```javascript
// componentSelector - Data Source:
{{ processedData.value?.allComponents?.map(c => ({ label: c, value: c })) || [] }}

// manufacturerSelector - Data Source:
{{ processedData.value?.allManufacturers?.map(m => ({ label: m, value: m })) || [] }}
```

### E. Main Chart Component
- **Chart Type**: Based on view type (Line, Heatmap, etc.)
- **Data Source**: `chartData.value`
- **Layout**: 
```javascript
{
  title: {
    'componentTrends': 'Component Type Lead Time Trends Over Time',
    'manufacturerTrends': 'Manufacturer Lead Time Trends Over Time', 
    'singleComponent': `Lead Time Trend: ${componentSelector.value}`,
    'heatmap': 'Lead Time Heatmap: Component Types vs Months',
    'overallTrend': 'Overall Lead Time Trend (All Components Combined)'
  }[viewTypeState.value] || 'Lead Time Analysis',
  xaxis: { title: 'Month' },
  yaxis: { title: 'Average Lead Time (weeks)' },
  yaxis2: viewTypeState.value === 'singleComponent' ? {
    title: 'Number of Data Points',
    overlaying: 'y',
    side: 'right'
  } : undefined
}
```

## Step 4: Final Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     HEADER SECTION                         │
│  📈 Historical Lead Time Analysis Dashboard                │
│  [Stat1] [Stat2] [Stat3] [Stat4]                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    CONTROLS SECTION                        │
│ [Component Trends] [Manufacturer Trends] [Single] [Heatmap] │
│ [Overall Trend]                                             │
│                                                             │
│ Component: [Dropdown▼]  Manufacturer: [Dropdown▼]          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    MAIN CHART                              │
│                 (Chart Component)                          │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Step 5: Test Your Dashboard

1. **Component Trends**: Shows top component types over time
2. **Manufacturer Trends**: Shows top manufacturers over time  
3. **Single Component**: Select component for detailed analysis
4. **Heatmap**: Visual heat map of components vs months
5. **Overall Trend**: Combined trend across all data

This will recreate your exact dashboard functionality in Retool using your production data with automatic manufacturer standardization!
