const fs = require('fs-extra');
const csv = require('csv-parser');
const XLSX = require('xlsx');

class HistoricalLeadTimeAnalyzer {
    constructor() {
        this.quotesData = [];
        this.timeSeriesData = new Map(); // key: "YYYY-MM", value: array of processed records
        this.componentTimeData = new Map(); // key: componentType, value: Map of "YYYY-MM" -> stats
        this.manufacturerTimeData = new Map(); // key: manufacturer, value: Map of "YYYY-MM" -> stats
        this.allMonths = new Set();
    }

    async loadData() {
        console.log('Loading lead time data...');
        
        try {
            await this.loadCSV('Package_Quote_Details.csv', (data) => {
                this.quotesData.push(data);
            });
            
            console.log(`Loaded ${this.quotesData.length} quotes`);
            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            return false;
        }
    }

    loadCSV(filename, callback) {
        return new Promise((resolve, reject) => {
            fs.createReadStream(filename)
                .pipe(csv())
                .on('data', callback)
                .on('end', resolve)
                .on('error', reject);
        });
    }

    parseDate(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return null;
            }
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            return `${year}-${month}`;
        } catch (error) {
            return null;
        }
    }

    processTimeSeriesData() {
        console.log('Processing time series data...');
        
        for (const row of this.quotesData) {
            try {
                const monthKey = this.parseDate(row.answer_date);
                if (!monthKey) continue;

                const leadTime = parseFloat(row.lead_time_weeks);
                if (isNaN(leadTime) || leadTime < 0) continue;

                // Parse component types and manufacturers
                const componentTypes = JSON.parse(row.component_types || '[]');
                const manufacturers = JSON.parse(row.manufacturer || '[]');
                
                // Create processed record for each component type
                for (const componentType of componentTypes) {
                    for (const manufacturer of manufacturers) {
                        const processedRecord = {
                            month: monthKey,
                            componentType: componentType.trim(),
                            manufacturer: manufacturer.trim(),
                            leadTime: leadTime,
                            projectName: row.project_name,
                            buyerName: row.buyer_name,
                            sellerName: row.seller_name,
                            cost: parseFloat(row.cost) || 0,
                            componentCount: parseInt(row.component_count) || 1
                        };

                        // Add to time series data
                        if (!this.timeSeriesData.has(monthKey)) {
                            this.timeSeriesData.set(monthKey, []);
                        }
                        this.timeSeriesData.get(monthKey).push(processedRecord);
                        this.allMonths.add(monthKey);
                    }
                }
            } catch (error) {
                console.error('Error processing row:', error);
                continue;
            }
        }

        console.log(`Processed data for ${this.allMonths.size} months`);
    }

    calculateComponentTimeSeries() {
        console.log('Calculating component type time series...');
        
        // Get all unique component types
        const allComponentTypes = new Set();
        for (const records of this.timeSeriesData.values()) {
            for (const record of records) {
                allComponentTypes.add(record.componentType);
            }
        }

        // Calculate stats for each component type by month
        for (const componentType of allComponentTypes) {
            const monthlyStats = new Map();
            
            for (const month of this.allMonths) {
                const monthData = this.timeSeriesData.get(month) || [];
                const componentData = monthData.filter(r => r.componentType === componentType);
                
                if (componentData.length > 0) {
                    const leadTimes = componentData.map(r => r.leadTime);
                    const avgLeadTime = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
                    const sortedTimes = [...leadTimes].sort((a, b) => a - b);
                    const median = sortedTimes.length % 2 === 0 
                        ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
                        : sortedTimes[Math.floor(sortedTimes.length / 2)];

                    monthlyStats.set(month, {
                        avgLeadTime: Math.round(avgLeadTime * 10) / 10,
                        medianLeadTime: Math.round(median * 10) / 10,
                        minLeadTime: Math.min(...leadTimes),
                        maxLeadTime: Math.max(...leadTimes),
                        dataPoints: leadTimes.length,
                        totalCost: componentData.reduce((sum, r) => sum + r.cost, 0),
                        projects: [...new Set(componentData.map(r => r.projectName))]
                    });
                }
            }
            
            this.componentTimeData.set(componentType, monthlyStats);
        }
    }

    calculateManufacturerTimeSeries() {
        console.log('Calculating manufacturer time series...');
        
        // Get all unique manufacturers
        const allManufacturers = new Set();
        for (const records of this.timeSeriesData.values()) {
            for (const record of records) {
                allManufacturers.add(record.manufacturer);
            }
        }

        // Calculate stats for each manufacturer by month
        for (const manufacturer of allManufacturers) {
            const monthlyStats = new Map();
            
            for (const month of this.allMonths) {
                const monthData = this.timeSeriesData.get(month) || [];
                const manufacturerData = monthData.filter(r => r.manufacturer === manufacturer);
                
                if (manufacturerData.length > 0) {
                    const leadTimes = manufacturerData.map(r => r.leadTime);
                    const avgLeadTime = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
                    const sortedTimes = [...leadTimes].sort((a, b) => a - b);
                    const median = sortedTimes.length % 2 === 0 
                        ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
                        : sortedTimes[Math.floor(sortedTimes.length / 2)];

                    monthlyStats.set(month, {
                        avgLeadTime: Math.round(avgLeadTime * 10) / 10,
                        medianLeadTime: Math.round(median * 10) / 10,
                        minLeadTime: Math.min(...leadTimes),
                        maxLeadTime: Math.max(...leadTimes),
                        dataPoints: leadTimes.length,
                        totalCost: manufacturerData.reduce((sum, r) => sum + r.cost, 0),
                        componentTypes: [...new Set(manufacturerData.map(r => r.componentType))]
                    });
                }
            }
            
            this.manufacturerTimeData.set(manufacturer, monthlyStats);
        }
    }

    getTopComponents(minDataPoints = 10) {
        const componentTotals = new Map();
        
        for (const [componentType, monthlyData] of this.componentTimeData) {
            let totalDataPoints = 0;
            for (const stats of monthlyData.values()) {
                totalDataPoints += stats.dataPoints;
            }
            componentTotals.set(componentType, totalDataPoints);
        }
        
        return Array.from(componentTotals.entries())
            .filter(([, total]) => total >= minDataPoints)
            .sort((a, b) => b[1] - a[1])
            .map(([componentType]) => componentType);
    }

    getTopManufacturers(minDataPoints = 10) {
        const manufacturerTotals = new Map();
        
        for (const [manufacturer, monthlyData] of this.manufacturerTimeData) {
            let totalDataPoints = 0;
            for (const stats of monthlyData.values()) {
                totalDataPoints += stats.dataPoints;
            }
            manufacturerTotals.set(manufacturer, totalDataPoints);
        }
        
        return Array.from(manufacturerTotals.entries())
            .filter(([, total]) => total >= minDataPoints)
            .sort((a, b) => b[1] - a[1])
            .map(([manufacturer]) => manufacturer);
    }

    serializeComponentData() {
        const serialized = {};
        for (const [componentType, monthlyData] of this.componentTimeData) {
            serialized[componentType] = {};
            for (const [month, stats] of monthlyData) {
                serialized[componentType][month] = stats;
            }
        }
        return serialized;
    }

    serializeManufacturerData() {
        const serialized = {};
        for (const [manufacturer, monthlyData] of this.manufacturerTimeData) {
            serialized[manufacturer] = {};
            for (const [month, stats] of monthlyData) {
                serialized[manufacturer][month] = stats;
            }
        }
        return serialized;
    }

    createHistoricalDashboard() {
        console.log('Creating historical dashboard...');
        
        const sortedMonths = Array.from(this.allMonths).sort();
        const topComponents = this.getTopComponents(5).slice(0, 10);
        const topManufacturers = this.getTopManufacturers(5).slice(0, 8);

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Historical Lead Time Analysis</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background-color: #f8f9fa;
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .chart-container { 
            width: 100%; 
            height: 600px; 
            margin-bottom: 30px; 
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary { 
            background: #e3f2fd; 
            padding: 20px; 
            border-radius: 10px; 
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .grid-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-box {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #1976d2;
        }
        .controls {
            background: white;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        select, button {
            margin: 5px;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        button {
            background-color: #1976d2;
            color: white;
            cursor: pointer;
        }
        button:hover {
            background-color: #1565c0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📈 Historical Lead Time Analysis Dashboard</h1>
        <p>Track lead time trends over time by component type and manufacturer</p>
        <div class="grid-container">
            <div class="stat-box">
                <div class="stat-number">${sortedMonths.length}</div>
                <div>Months of Data</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${Object.keys(this.serializeComponentData()).length}</div>
                <div>Total Component Types</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${Object.keys(this.serializeManufacturerData()).length}</div>
                <div>Total Manufacturers</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${this.quotesData.length}</div>
                <div>Total Quotes</div>
            </div>
        </div>
    </div>

    <div class="controls">
        <label>Select View: </label>
        <button onclick="showComponentTrends()">Component Trends</button>
        <button onclick="showManufacturerTrends()">Manufacturer Trends</button>
        <button onclick="showSingleComponent()">Single Component</button>
        <button onclick="showHeatmap()">Monthly Heatmap</button>
        <button onclick="showOverallTrend()">Overall Trend</button>
    </div>
    
    <div class="controls">
        <label>Component Selector: </label>
        <select id="componentSelector" onchange="updateSingleComponentView()">
            <option value="">Select a component type...</option>
        </select>
        <label style="margin-left: 20px;">Manufacturer Selector: </label>
        <select id="manufacturerSelector" onchange="updateSingleManufacturerView()">
            <option value="">Select a manufacturer...</option>
        </select>
    </div>
    
    <div class="chart-container" id="mainChart"></div>
    <div class="chart-container" id="secondaryChart"></div>
    
    <div class="summary">
        <h3>📊 Key Insights</h3>
        <div id="insights"></div>
    </div>

    <script>
        const months = ${JSON.stringify(sortedMonths)};
        const topComponents = ${JSON.stringify(topComponents)};
        const topManufacturers = ${JSON.stringify(topManufacturers)};
        const componentData = ${JSON.stringify(this.serializeComponentData())};
        const manufacturerData = ${JSON.stringify(this.serializeManufacturerData())};

        function getComponentTimeSeriesData(componentType) {
            const monthlyData = componentData[componentType] || {};
            
            return months.map(month => {
                const stats = monthlyData[month];
                return stats ? stats.avgLeadTime : null;
            });
        }

        function getManufacturerTimeSeriesData(manufacturer) {
            const monthlyData = manufacturerData[manufacturer] || {};
            
            return months.map(month => {
                const stats = monthlyData[month];
                return stats ? stats.avgLeadTime : null;
            });
        }

        function showComponentTrends() {
            const traces = topComponents.slice(0, 8).map(component => ({
                x: months,
                y: getComponentTimeSeriesData(component),
                type: 'scatter',
                mode: 'lines+markers',
                name: component.length > 30 ? component.substring(0, 30) + '...' : component,
                connectgaps: false
            }));

            const layout = {
                title: 'Component Type Lead Time Trends Over Time',
                xaxis: { title: 'Month' },
                yaxis: { title: 'Average Lead Time (weeks)' },
                hovermode: 'x unified'
            };

            Plotly.newPlot('mainChart', traces, layout);
            updateInsights('component');
        }

        function showManufacturerTrends() {
            const traces = topManufacturers.slice(0, 8).map(manufacturer => ({
                x: months,
                y: getManufacturerTimeSeriesData(manufacturer),
                type: 'scatter',
                mode: 'lines+markers',
                name: manufacturer,
                connectgaps: false
            }));

            const layout = {
                title: 'Manufacturer Lead Time Trends Over Time',
                xaxis: { title: 'Month' },
                yaxis: { title: 'Average Lead Time (weeks)' },
                hovermode: 'x unified'
            };

            Plotly.newPlot('mainChart', traces, layout);
            updateInsights('manufacturer');
        }

        function showHeatmap() {
            const heatmapData = [];
            const componentLabels = [];
            
            topComponents.slice(0, 15).forEach(component => {
                const monthlyData = componentData[component] || {};
                const row = months.map(month => {
                    const stats = monthlyData[month];
                    return stats ? stats.avgLeadTime : null;
                });
                heatmapData.push(row);
                componentLabels.push(component.length > 25 ? component.substring(0, 25) + '...' : component);
            });

            const trace = {
                z: heatmapData,
                x: months,
                y: componentLabels,
                type: 'heatmap',
                colorscale: 'RdYlBu_r',
                showscale: true,
                colorbar: { title: 'Lead Time (weeks)' }
            };

            const layout = {
                title: 'Lead Time Heatmap: Component Types vs Months',
                xaxis: { title: 'Month' },
                yaxis: { title: 'Component Type' }
            };

            Plotly.newPlot('mainChart', [trace], layout);
            updateInsights('heatmap');
        }

        function showOverallTrend() {
            // Calculate overall monthly averages
            const overallData = months.map(month => {
                let totalLeadTime = 0;
                let totalDataPoints = 0;
                
                for (const component of Object.keys(componentData)) {
                    const monthlyData = componentData[component];
                    const stats = monthlyData[month];
                    if (stats) {
                        totalLeadTime += stats.avgLeadTime * stats.dataPoints;
                        totalDataPoints += stats.dataPoints;
                    }
                }
                
                return totalDataPoints > 0 ? totalLeadTime / totalDataPoints : null;
            });

            const trace = {
                x: months,
                y: overallData,
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Overall Average',
                line: { width: 3, color: '#1976d2' },
                marker: { size: 8 }
            };

            const layout = {
                title: 'Overall Lead Time Trend (All Components Combined)',
                xaxis: { title: 'Month' },
                yaxis: { title: 'Average Lead Time (weeks)' }
            };

            Plotly.newPlot('mainChart', [trace], layout);
            updateInsights('overall');
        }

        function showSingleComponent() {
            const componentSelector = document.getElementById('componentSelector');
            const selectedComponent = componentSelector.value;
            
            if (!selectedComponent) {
                alert('Please select a component type from the dropdown first.');
                return;
            }
            
            updateSingleComponentView();
        }

        function updateSingleComponentView() {
            const componentSelector = document.getElementById('componentSelector');
            const selectedComponent = componentSelector.value;
            
            if (!selectedComponent) return;
            
            const componentStats = componentData[selectedComponent] || {};
            const dataPoints = months.map(month => {
                const stats = componentStats[month];
                return stats ? stats.dataPoints : 0;
            });
            
            const leadTimeTrace = {
                x: months,
                y: getComponentTimeSeriesData(selectedComponent),
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Average Lead Time',
                line: { width: 3, color: '#1976d2' },
                marker: { size: 8 },
                yaxis: 'y'
            };
            
            const dataPointsTrace = {
                x: months,
                y: dataPoints,
                type: 'bar',
                name: 'Data Points',
                marker: { color: 'rgba(255, 99, 132, 0.6)' },
                yaxis: 'y2'
            };

            const layout = {
                title: \`Lead Time Trend: \${selectedComponent}\`,
                xaxis: { title: 'Month' },
                yaxis: { 
                    title: 'Average Lead Time (weeks)',
                    side: 'left'
                },
                yaxis2: {
                    title: 'Number of Data Points',
                    overlaying: 'y',
                    side: 'right'
                },
                hovermode: 'x unified'
            };

            Plotly.newPlot('mainChart', [leadTimeTrace, dataPointsTrace], layout);
            
            // Show manufacturers for this component in secondary chart
            showManufacturersForComponent(selectedComponent);
            updateInsights('singleComponent', selectedComponent);
        }

        function updateSingleManufacturerView() {
            const manufacturerSelector = document.getElementById('manufacturerSelector');
            const selectedManufacturer = manufacturerSelector.value;
            
            if (!selectedManufacturer) return;
            
            const manufacturerStats = manufacturerData[selectedManufacturer] || {};
            const dataPoints = months.map(month => {
                const stats = manufacturerStats[month];
                return stats ? stats.dataPoints : 0;
            });
            
            const leadTimeTrace = {
                x: months,
                y: getManufacturerTimeSeriesData(selectedManufacturer),
                type: 'scatter',
                mode: 'lines+markers',
                name: 'Average Lead Time',
                line: { width: 3, color: '#ff6b35' },
                marker: { size: 8 },
                yaxis: 'y'
            };
            
            const dataPointsTrace = {
                x: months,
                y: dataPoints,
                type: 'bar',
                name: 'Data Points',
                marker: { color: 'rgba(54, 162, 235, 0.6)' },
                yaxis: 'y2'
            };

            const layout = {
                title: \`Lead Time Trend: \${selectedManufacturer}\`,
                xaxis: { title: 'Month' },
                yaxis: { 
                    title: 'Average Lead Time (weeks)',
                    side: 'left'
                },
                yaxis2: {
                    title: 'Number of Data Points',
                    overlaying: 'y',
                    side: 'right'
                },
                hovermode: 'x unified'
            };

            Plotly.newPlot('mainChart', [leadTimeTrace, dataPointsTrace], layout);
            updateInsights('singleManufacturer', selectedManufacturer);
        }

        function showManufacturersForComponent(componentType) {
            // Find manufacturers that supply this component
            const relevantManufacturers = [];
            
            for (const manufacturer of Object.keys(manufacturerData)) {
                const manufacturerStats = manufacturerData[manufacturer];
                // Check if this manufacturer has data for the selected component
                for (const month of months) {
                    const stats = manufacturerStats[month];
                    if (stats && stats.componentTypes && stats.componentTypes.includes(componentType)) {
                        relevantManufacturers.push(manufacturer);
                        break;
                    }
                }
            }
            
            if (relevantManufacturers.length > 0) {
                const traces = relevantManufacturers.slice(0, 6).map(manufacturer => ({
                    x: months,
                    y: getManufacturerTimeSeriesData(manufacturer),
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: manufacturer,
                    connectgaps: false
                }));

                const layout = {
                    title: \`Manufacturers Supplying: \${componentType}\`,
                    xaxis: { title: 'Month' },
                    yaxis: { title: 'Average Lead Time (weeks)' },
                    hovermode: 'x unified'
                };

                Plotly.newPlot('secondaryChart', traces, layout);
            } else {
                document.getElementById('secondaryChart').innerHTML = '<p style="text-align: center; padding: 50px;">No manufacturer data available for this component type.</p>';
            }
        }

        function populateDropdowns() {
            // Populate component selector
            const componentSelector = document.getElementById('componentSelector');
            const allComponents = Object.keys(componentData).sort();
            
            allComponents.forEach(component => {
                const option = document.createElement('option');
                option.value = component;
                option.textContent = component.length > 50 ? component.substring(0, 50) + '...' : component;
                componentSelector.appendChild(option);
            });
            
            // Populate manufacturer selector
            const manufacturerSelector = document.getElementById('manufacturerSelector');
            const allManufacturers = Object.keys(manufacturerData).sort();
            
            allManufacturers.forEach(manufacturer => {
                const option = document.createElement('option');
                option.value = manufacturer;
                option.textContent = manufacturer;
                manufacturerSelector.appendChild(option);
            });
        }

        function updateInsights(viewType, selectedItem = null) {
            let insights = '';
            
            switch(viewType) {
                case 'component':
                    insights = \`
                        <p><strong>Component Analysis:</strong></p>
                        <ul>
                            <li>Tracking \${topComponents.length} component types with sufficient data</li>
                            <li>Most tracked component: \${topComponents[0]}</li>
                            <li>Data spans \${months.length} months from \${months[0]} to \${months[months.length-1]}</li>
                        </ul>
                    \`;
                    break;
                case 'manufacturer':
                    insights = \`
                        <p><strong>Manufacturer Analysis:</strong></p>
                        <ul>
                            <li>Tracking \${topManufacturers.length} manufacturers with sufficient data</li>
                            <li>Most tracked manufacturer: \${topManufacturers[0]}</li>
                            <li>Use this view to identify manufacturer performance trends</li>
                        </ul>
                    \`;
                    break;
                case 'singleComponent':
                    const componentStats = componentData[selectedItem] || {};
                    const totalDataPoints = Object.values(componentStats).reduce((sum, stats) => sum + (stats.dataPoints || 0), 0);
                    const avgLeadTime = Object.values(componentStats).reduce((sum, stats, index, arr) => {
                        return sum + (stats.avgLeadTime || 0) / arr.length;
                    }, 0);
                    
                    insights = \`
                        <p><strong>Single Component Analysis: \${selectedItem}</strong></p>
                        <ul>
                            <li>Total data points across all months: \${totalDataPoints}</li>
                            <li>Overall average lead time: \${avgLeadTime.toFixed(1)} weeks</li>
                            <li>Data available for \${Object.keys(componentStats).length} months</li>
                            <li>Chart shows both lead time trend and data reliability (bar chart)</li>
                        </ul>
                    \`;
                    break;
                case 'singleManufacturer':
                    const manufacturerStats = manufacturerData[selectedItem] || {};
                    const totalMfgDataPoints = Object.values(manufacturerStats).reduce((sum, stats) => sum + (stats.dataPoints || 0), 0);
                    const avgMfgLeadTime = Object.values(manufacturerStats).reduce((sum, stats, index, arr) => {
                        return sum + (stats.avgLeadTime || 0) / arr.length;
                    }, 0);
                    
                    insights = \`
                        <p><strong>Single Manufacturer Analysis: \${selectedItem}</strong></p>
                        <ul>
                            <li>Total data points across all months: \${totalMfgDataPoints}</li>
                            <li>Overall average lead time: \${avgMfgLeadTime.toFixed(1)} weeks</li>
                            <li>Data available for \${Object.keys(manufacturerStats).length} months</li>
                            <li>Chart shows both lead time trend and data reliability (bar chart)</li>
                        </ul>
                    \`;
                    break;
                case 'heatmap':
                    insights = \`
                        <p><strong>Heatmap Analysis:</strong></p>
                        <ul>
                            <li>Red areas indicate higher lead times, blue areas indicate lower lead times</li>
                            <li>White/missing areas indicate no data for that component in that month</li>
                            <li>Use this to quickly spot seasonal patterns or trends</li>
                        </ul>
                    \`;
                    break;
                case 'overall':
                    insights = \`
                        <p><strong>Overall Trend Analysis:</strong></p>
                        <ul>
                            <li>Shows weighted average lead time across all components and manufacturers</li>
                            <li>Useful for identifying industry-wide trends</li>
                            <li>Combines all data points for each month</li>
                        </ul>
                    \`;
                    break;
            }
            
            document.getElementById('insights').innerHTML = insights;
        }

        // Initialize dropdowns and show component trends
        populateDropdowns();
        showComponentTrends();
    </script>
</body>
</html>`;

        fs.writeFileSync('historical_lead_time_dashboard.html', html);
        console.log('✓ Historical dashboard saved to historical_lead_time_dashboard.html');
    }

    exportHistoricalData() {
        console.log('Exporting historical data to Excel...');
        
        try {
            const wb = XLSX.utils.book_new();
            
            // Component time series data
            const componentTimeSeriesData = [];
            for (const [componentType, monthlyData] of this.componentTimeData) {
                for (const [month, stats] of monthlyData) {
                    componentTimeSeriesData.push({
                        'Component Type': componentType,
                        'Month': month,
                        'Average Lead Time (weeks)': stats.avgLeadTime,
                        'Median Lead Time (weeks)': stats.medianLeadTime,
                        'Min Lead Time (weeks)': stats.minLeadTime,
                        'Max Lead Time (weeks)': stats.maxLeadTime,
                        'Data Points': stats.dataPoints,
                        'Total Cost': stats.totalCost,
                        'Project Count': stats.projects.length
                    });
                }
            }
            
            const componentWS = XLSX.utils.json_to_sheet(componentTimeSeriesData);
            XLSX.utils.book_append_sheet(wb, componentWS, 'Component Time Series');
            
            // Manufacturer time series data
            const manufacturerTimeSeriesData = [];
            for (const [manufacturer, monthlyData] of this.manufacturerTimeData) {
                for (const [month, stats] of monthlyData) {
                    manufacturerTimeSeriesData.push({
                        'Manufacturer': manufacturer,
                        'Month': month,
                        'Average Lead Time (weeks)': stats.avgLeadTime,
                        'Median Lead Time (weeks)': stats.medianLeadTime,
                        'Min Lead Time (weeks)': stats.minLeadTime,
                        'Max Lead Time (weeks)': stats.maxLeadTime,
                        'Data Points': stats.dataPoints,
                        'Total Cost': stats.totalCost,
                        'Component Type Count': stats.componentTypes.length
                    });
                }
            }
            
            const manufacturerWS = XLSX.utils.json_to_sheet(manufacturerTimeSeriesData);
            XLSX.utils.book_append_sheet(wb, manufacturerWS, 'Manufacturer Time Series');
            
            // Summary by month
            const monthlySummaryData = [];
            for (const month of Array.from(this.allMonths).sort()) {
                const monthData = this.timeSeriesData.get(month) || [];
                if (monthData.length > 0) {
                    const leadTimes = monthData.map(r => r.leadTime);
                    const avgLeadTime = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
                    
                    monthlySummaryData.push({
                        'Month': month,
                        'Total Quotes': monthData.length,
                        'Unique Components': new Set(monthData.map(r => r.componentType)).size,
                        'Unique Manufacturers': new Set(monthData.map(r => r.manufacturer)).size,
                        'Average Lead Time (weeks)': Math.round(avgLeadTime * 10) / 10,
                        'Min Lead Time (weeks)': Math.min(...leadTimes),
                        'Max Lead Time (weeks)': Math.max(...leadTimes),
                        'Total Cost': monthData.reduce((sum, r) => sum + r.cost, 0)
                    });
                }
            }
            
            const summaryWS = XLSX.utils.json_to_sheet(monthlySummaryData);
            XLSX.utils.book_append_sheet(wb, summaryWS, 'Monthly Summary');
            
            const filename = 'historical_lead_time_analysis.xlsx';
            XLSX.writeFile(wb, filename);
            console.log(`✓ Historical data exported to ${filename}`);
            
            return filename;
        } catch (error) {
            console.error('Error exporting historical data:', error);
            return null;
        }
    }

    generateTimeSeriesSummary() {
        console.log('\n' + '='.repeat(80));
        console.log('HISTORICAL LEAD TIME ANALYSIS SUMMARY');
        console.log('='.repeat(80));
        
        const sortedMonths = Array.from(this.allMonths).sort();
        const topComponents = this.getTopComponents(5);
        const topManufacturers = this.getTopManufacturers(5);
        
        console.log(`\nTIME PERIOD ANALYSIS:`);
        console.log(`• Date range: ${sortedMonths[0]} to ${sortedMonths[sortedMonths.length - 1]}`);
        console.log(`• Total months with data: ${sortedMonths.length}`);
        console.log(`• Total processed records: ${Array.from(this.timeSeriesData.values()).flat().length}`);
        
        console.log(`\nCOMPONENT TYPE TRENDS:`);
        console.log(`• Component types with sufficient data: ${topComponents.length}`);
        console.log(`• Most tracked component types:`);
        
        for (let i = 0; i < Math.min(5, topComponents.length); i++) {
            const component = topComponents[i];
            const monthlyData = this.componentTimeData.get(component);
            let totalDataPoints = 0;
            let monthsWithData = 0;
            for (const stats of monthlyData.values()) {
                totalDataPoints += stats.dataPoints;
                monthsWithData++;
            }
            console.log(`  ${i + 1}. ${component.substring(0, 50)}${component.length > 50 ? '...' : ''}`);
            console.log(`     Total quotes: ${totalDataPoints}, Months: ${monthsWithData}`);
        }
        
        console.log(`\nMANUFACTURER TRENDS:`);
        console.log(`• Manufacturers with sufficient data: ${topManufacturers.length}`);
        console.log(`• Most tracked manufacturers:`);
        
        for (let i = 0; i < Math.min(5, topManufacturers.length); i++) {
            const manufacturer = topManufacturers[i];
            const monthlyData = this.manufacturerTimeData.get(manufacturer);
            let totalDataPoints = 0;
            let monthsWithData = 0;
            for (const stats of monthlyData.values()) {
                totalDataPoints += stats.dataPoints;
                monthsWithData++;
            }
            console.log(`  ${i + 1}. ${manufacturer}`);
            console.log(`     Total quotes: ${totalDataPoints}, Months: ${monthsWithData}`);
        }
        
        // Calculate overall trend
        console.log(`\nOVERALL TREND ANALYSIS:`);
        const overallTrends = [];
        for (const month of sortedMonths) {
            const monthData = this.timeSeriesData.get(month) || [];
            if (monthData.length > 0) {
                const avgLeadTime = monthData.reduce((sum, r) => sum + r.leadTime, 0) / monthData.length;
                overallTrends.push({ month, avgLeadTime, dataPoints: monthData.length });
            }
        }
        
        if (overallTrends.length >= 2) {
            const firstMonth = overallTrends[0];
            const lastMonth = overallTrends[overallTrends.length - 1];
            const trendDirection = lastMonth.avgLeadTime > firstMonth.avgLeadTime ? '📈 Increasing' : '📉 Decreasing';
            const trendMagnitude = Math.abs(lastMonth.avgLeadTime - firstMonth.avgLeadTime);
            
            console.log(`• Overall trend: ${trendDirection} by ${trendMagnitude.toFixed(1)} weeks`);
            console.log(`• ${firstMonth.month}: ${firstMonth.avgLeadTime.toFixed(1)} weeks avg (${firstMonth.dataPoints} quotes)`);
            console.log(`• ${lastMonth.month}: ${lastMonth.avgLeadTime.toFixed(1)} weeks avg (${lastMonth.dataPoints} quotes)`);
        }
    }

    async runHistoricalAnalysis() {
        console.log('Starting Historical Lead Time Analysis...\n');
        
        if (!(await this.loadData())) {
            return;
        }
        
        // Process time series data
        this.processTimeSeriesData();
        
        // Calculate component and manufacturer time series
        this.calculateComponentTimeSeries();
        this.calculateManufacturerTimeSeries();
        
        // Generate summary
        this.generateTimeSeriesSummary();
        
        // Create interactive dashboard
        this.createHistoricalDashboard();
        
        // Export data
        const excelFile = this.exportHistoricalData();
        
        console.log(`\n` + '='.repeat(80));
        console.log('HISTORICAL ANALYSIS COMPLETE!');
        console.log('='.repeat(80));
        console.log('Files created:');
        console.log('• historical_lead_time_dashboard.html - Interactive time series dashboard');
        if (excelFile) {
            console.log(`• ${excelFile} - Complete historical data export`);
        }
        console.log('\nUse the dashboard to:');
        console.log('• View component type trends over time');
        console.log('• Track manufacturer performance changes');
        console.log('• Identify seasonal patterns');
        console.log('• Compare lead times across different time periods');
        
        return { componentTimeData: this.componentTimeData, manufacturerTimeData: this.manufacturerTimeData };
    }
}

// Run the historical analysis
const analyzer = new HistoricalLeadTimeAnalyzer();
analyzer.runHistoricalAnalysis().catch(console.error);
