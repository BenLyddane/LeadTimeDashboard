const fs = require('fs-extra');
const csv = require('csv-parser');
const XLSX = require('xlsx');

class LeadTimeAnalyzer {
    constructor() {
        this.quotesData = [];
        this.componentsData = [];
        this.componentHierarchy = new Map();
        this.componentLeadTimes = new Map();
    }

    async loadData() {
        console.log('Loading data...');
        
        try {
            // Load quotes data
            await this.loadCSV('Package_Quote_Details.csv', (data) => {
                this.quotesData.push(data);
            });
            
            // Load components data
            await this.loadCSV('component_type_prod_db_5.7.2025.csv', (data) => {
                this.componentsData.push(data);
            });
            
            console.log(`Loaded ${this.quotesData.length} quotes and ${this.componentsData.length} component types`);
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

    parseComponentTypes() {
        console.log('Parsing component types from quotes...');
        
        for (const row of this.quotesData) {
            try {
                // Parse the JSON array of component types
                const componentTypes = JSON.parse(row.component_types || '[]');
                const leadTime = parseFloat(row.lead_time_weeks);
                
                // Skip invalid lead times
                if (isNaN(leadTime) || leadTime < 0) {
                    continue;
                }
                
                // Add lead time for each component type in this quote
                for (const componentType of componentTypes) {
                    if (!this.componentLeadTimes.has(componentType)) {
                        this.componentLeadTimes.set(componentType, []);
                    }
                    this.componentLeadTimes.get(componentType).push(leadTime);
                }
            } catch (error) {
                console.error('Error parsing component types in row:', error);
                continue;
            }
        }
    }

    buildHierarchy() {
        console.log('Building component hierarchy...');
        
        // Create a mapping of component name to its details
        for (const row of this.componentsData) {
            const componentName = row.component_type.trim();
            this.componentHierarchy.set(componentName, {
                id: row.id,
                level: parseInt(row.level),
                treePath: row.tree_path,
                parent: null,
                children: [],
                allDescendants: new Set()
            });
        }
        
        // Build parent-child relationships
        for (const [componentName, details] of this.componentHierarchy) {
            const treePath = details.treePath;
            const pathParts = treePath.split(' > ').map(part => part.trim());
            
            // Find parent (previous level in path)
            if (pathParts.length > 1) {
                const parentName = pathParts[pathParts.length - 2];
                details.parent = parentName;
                
                // Add this component as child to parent
                if (this.componentHierarchy.has(parentName)) {
                    this.componentHierarchy.get(parentName).children.push(componentName);
                }
            }
        }
        
        // Build all descendants for each component
        const getAllDescendants = (componentName) => {
            const descendants = new Set();
            if (this.componentHierarchy.has(componentName)) {
                const children = this.componentHierarchy.get(componentName).children;
                for (const child of children) {
                    descendants.add(child);
                    const childDescendants = getAllDescendants(child);
                    childDescendants.forEach(desc => descendants.add(desc));
                }
            }
            return descendants;
        };
        
        for (const componentName of this.componentHierarchy.keys()) {
            this.componentHierarchy.get(componentName).allDescendants = getAllDescendants(componentName);
        }
    }

    calculateIndividualLeadTimes() {
        console.log('Calculating individual component lead times...');
        
        const results = [];
        
        for (const [componentType, leadTimes] of this.componentLeadTimes) {
            if (leadTimes.length > 0) {
                const avgLeadTime = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
                const sortedTimes = [...leadTimes].sort((a, b) => a - b);
                const median = sortedTimes.length % 2 === 0 
                    ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
                    : sortedTimes[Math.floor(sortedTimes.length / 2)];
                
                const variance = leadTimes.reduce((acc, val) => acc + Math.pow(val - avgLeadTime, 2), 0) / leadTimes.length;
                const stdDev = Math.sqrt(variance);
                
                results.push({
                    'Component Type': componentType,
                    'Average Lead Time (weeks)': Math.round(avgLeadTime * 10) / 10,
                    'Median Lead Time (weeks)': Math.round(median * 10) / 10,
                    'Min Lead Time (weeks)': Math.min(...leadTimes),
                    'Max Lead Time (weeks)': Math.max(...leadTimes),
                    'Data Points': leadTimes.length,
                    'Std Dev': Math.round(stdDev * 10) / 10
                });
            }
        }
        
        // Sort by number of data points (descending)
        results.sort((a, b) => b['Data Points'] - a['Data Points']);
        
        return results;
    }

    calculateRolledUpLeadTimes() {
        console.log('Calculating rolled-up (hierarchical) lead times...');
        
        const results = [];
        
        for (const [componentName, details] of this.componentHierarchy) {
            // Get all lead times for this component and its descendants
            const allLeadTimes = [];
            
            // Add direct lead times for this component
            if (this.componentLeadTimes.has(componentName)) {
                allLeadTimes.push(...this.componentLeadTimes.get(componentName));
            }
            
            // Add lead times for all descendants
            for (const descendant of details.allDescendants) {
                if (this.componentLeadTimes.has(descendant)) {
                    allLeadTimes.push(...this.componentLeadTimes.get(descendant));
                }
            }
            
            if (allLeadTimes.length > 0) {
                const avgLeadTime = allLeadTimes.reduce((a, b) => a + b, 0) / allLeadTimes.length;
                const sortedTimes = [...allLeadTimes].sort((a, b) => a - b);
                const median = sortedTimes.length % 2 === 0 
                    ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
                    : sortedTimes[Math.floor(sortedTimes.length / 2)];
                
                const variance = allLeadTimes.reduce((acc, val) => acc + Math.pow(val - avgLeadTime, 2), 0) / allLeadTimes.length;
                const stdDev = Math.sqrt(variance);
                
                const directDataPoints = this.componentLeadTimes.has(componentName) 
                    ? this.componentLeadTimes.get(componentName).length 
                    : 0;
                
                results.push({
                    'Component Type': componentName,
                    'Level': details.level,
                    'Tree Path': details.treePath,
                    'Average Lead Time (weeks)': Math.round(avgLeadTime * 10) / 10,
                    'Median Lead Time (weeks)': Math.round(median * 10) / 10,
                    'Total Data Points': allLeadTimes.length,
                    'Direct Data Points': directDataPoints,
                    'Children Data Points': allLeadTimes.length - directDataPoints,
                    'Std Dev': Math.round(stdDev * 10) / 10
                });
            }
        }
        
        // Sort by total data points (descending)
        results.sort((a, b) => b['Total Data Points'] - a['Total Data Points']);
        
        return results;
    }

    createInteractiveHTML(individualResults, hierarchicalResults) {
        console.log('Creating interactive HTML visualizations...');
        
        // Create individual components chart
        const individualHTML = this.createIndividualChart(individualResults.slice(0, 20));
        fs.writeFileSync('individual_component_lead_times.html', individualHTML);
        
        // Create hierarchical chart
        const hierarchicalHTML = this.createHierarchicalChart(hierarchicalResults.slice(0, 15));
        fs.writeFileSync('hierarchical_lead_times.html', hierarchicalHTML);
        
        console.log('✓ Interactive visualizations saved to HTML files');
    }

    createIndividualChart(data) {
        const componentNames = data.map(d => d['Component Type']);
        const leadTimes = data.map(d => d['Average Lead Time (weeks)']);
        const dataPoints = data.map(d => d['Data Points']);
        
        const maxNameLength = 25;
        const truncatedNames = componentNames.map(name => 
            name.length > maxNameLength ? name.substring(0, maxNameLength) + '...' : name
        );
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Individual Component Lead Times</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .chart-container { width: 100%; height: 700px; margin-bottom: 30px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Lead Time Analysis: Individual Components</h1>
        <p>Top 20 Component Types by Number of Data Points (Most Reliable)</p>
    </div>
    
    <div class="chart-container" id="leadTimeChart"></div>
    <div class="chart-container" id="dataPointsChart"></div>
    
    <div class="summary">
        <h3>Summary Statistics</h3>
        <p><strong>Most Common Component:</strong> ${data[0]['Component Type']} (${data[0]['Data Points']} data points)</p>
        <p><strong>Highest Lead Time:</strong> ${data.reduce((max, d) => d['Average Lead Time (weeks)'] > max['Average Lead Time (weeks)'] ? d : max)['Component Type']} (${Math.max(...leadTimes)} weeks)</p>
        <p><strong>Lowest Lead Time:</strong> ${data.reduce((min, d) => d['Average Lead Time (weeks)'] < min['Average Lead Time (weeks)'] ? d : min)['Component Type']} (${Math.min(...leadTimes)} weeks)</p>
    </div>

    <script>
        // Lead Time Chart
        const leadTimeTrace = {
            x: ${JSON.stringify(truncatedNames)},
            y: ${JSON.stringify(leadTimes)},
            type: 'bar',
            text: ${JSON.stringify(dataPoints.map(d => 'n=' + d))},
            textposition: 'outside',
            marker: { color: 'steelblue' },
            name: 'Average Lead Time'
        };
        
        const leadTimeLayout = {
            title: 'Average Lead Time by Component Type',
            xaxis: { 
                title: 'Component Type',
                tickangle: -45,
                automargin: true
            },
            yaxis: { title: 'Average Lead Time (weeks)' },
            margin: { l: 60, r: 60, t: 80, b: 150 }
        };
        
        Plotly.newPlot('leadTimeChart', [leadTimeTrace], leadTimeLayout);
        
        // Data Points Chart
        const dataPointsTrace = {
            x: ${JSON.stringify(truncatedNames)},
            y: ${JSON.stringify(dataPoints)},
            type: 'bar',
            text: ${JSON.stringify(leadTimes.map(d => d + 'w'))},
            textposition: 'outside',
            marker: { color: 'lightcoral' },
            name: 'Data Points'
        };
        
        const dataPointsLayout = {
            title: 'Number of Data Points per Component Type',
            xaxis: { 
                title: 'Component Type',
                tickangle: -45,
                automargin: true
            },
            yaxis: { title: 'Number of Data Points' },
            margin: { l: 60, r: 60, t: 80, b: 150 }
        };
        
        Plotly.newPlot('dataPointsChart', [dataPointsTrace], dataPointsLayout);
    </script>
</body>
</html>`;
    }

    createHierarchicalChart(data) {
        const componentNames = data.map(d => d['Component Type']);
        const leadTimes = data.map(d => d['Average Lead Time (weeks)']);
        const totalDataPoints = data.map(d => d['Total Data Points']);
        const directDataPoints = data.map(d => d['Direct Data Points']);
        const childrenDataPoints = data.map(d => d['Children Data Points']);
        
        const maxNameLength = 25;
        const truncatedNames = componentNames.map(name => 
            name.length > maxNameLength ? name.substring(0, maxNameLength) + '...' : name
        );
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Hierarchical Lead Times</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .chart-container { width: 100%; height: 600px; margin-bottom: 30px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Lead Time Analysis: Hierarchical (Rolled-Up)</h1>
        <p>Top 15 Component Types by Total Data Points (Including All Children)</p>
    </div>
    
    <div class="chart-container" id="hierarchicalChart"></div>
    <div class="chart-container" id="stackedChart"></div>
    
    <div class="summary">
        <h3>Summary Statistics</h3>
        <p><strong>Component with Most Total Data:</strong> ${data[0]['Component Type']} (${data[0]['Total Data Points']} total points)</p>
        <p><strong>Highest Hierarchical Lead Time:</strong> ${data.reduce((max, d) => d['Average Lead Time (weeks)'] > max['Average Lead Time (weeks)'] ? d : max)['Component Type']} (${Math.max(...leadTimes)} weeks)</p>
        <p><strong>Deepest Level Component:</strong> Level ${Math.max(...data.map(d => d.Level))}</p>
    </div>

    <script>
        // Hierarchical Lead Time Chart
        const hierarchicalTrace = {
            x: ${JSON.stringify(truncatedNames)},
            y: ${JSON.stringify(leadTimes)},
            type: 'bar',
            text: ${JSON.stringify(totalDataPoints.map(d => 'Total: ' + d))},
            textposition: 'outside',
            marker: { color: 'forestgreen' },
            name: 'Average Lead Time'
        };
        
        const hierarchicalLayout = {
            title: 'Rolled-Up Lead Times (Component + All Children)',
            xaxis: { 
                title: 'Component Type',
                tickangle: -45,
                automargin: true
            },
            yaxis: { title: 'Average Lead Time (weeks)' },
            margin: { l: 60, r: 60, t: 80, b: 150 }
        };
        
        Plotly.newPlot('hierarchicalChart', [hierarchicalTrace], hierarchicalLayout);
        
        // Stacked Data Points Chart
        const directTrace = {
            x: ${JSON.stringify(truncatedNames)},
            y: ${JSON.stringify(directDataPoints)},
            type: 'bar',
            name: 'Direct Data Points',
            marker: { color: 'lightgreen' }
        };
        
        const childrenTrace = {
            x: ${JSON.stringify(truncatedNames)},
            y: ${JSON.stringify(childrenDataPoints)},
            type: 'bar',
            name: 'Children Data Points',
            marker: { color: 'orange' }
        };
        
        const stackedLayout = {
            title: 'Data Point Composition (Direct vs Children)',
            xaxis: { 
                title: 'Component Type',
                tickangle: -45,
                automargin: true
            },
            yaxis: { title: 'Number of Data Points' },
            barmode: 'stack',
            margin: { l: 60, r: 60, t: 80, b: 150 }
        };
        
        Plotly.newPlot('stackedChart', [directTrace, childrenTrace], stackedLayout);
    </script>
</body>
</html>`;
    }

    generateSummaryStats(individualResults, hierarchicalResults) {
        console.log('\n' + '='.repeat(80));
        console.log('LEAD TIME ANALYSIS SUMMARY');
        console.log('='.repeat(80));
        
        console.log(`\nINDIVIDUAL COMPONENT ANALYSIS:`);
        console.log(`• Total unique component types with data: ${individualResults.length}`);
        console.log(`• Most common component: ${individualResults[0]['Component Type']} (${individualResults[0]['Data Points']} quotes)`);
        
        const highestIndividual = individualResults.reduce((max, d) => 
            d['Average Lead Time (weeks)'] > max['Average Lead Time (weeks)'] ? d : max);
        const lowestIndividual = individualResults.reduce((min, d) => 
            d['Average Lead Time (weeks)'] < min['Average Lead Time (weeks)'] ? d : min);
        
        console.log(`• Highest average lead time: ${highestIndividual['Component Type']} (${highestIndividual['Average Lead Time (weeks)']} weeks)`);
        console.log(`• Lowest average lead time: ${lowestIndividual['Component Type']} (${lowestIndividual['Average Lead Time (weeks)']} weeks)`);
        
        console.log(`\nHIERARCHICAL (ROLLED-UP) ANALYSIS:`);
        console.log(`• Total component types in hierarchy: ${hierarchicalResults.length}`);
        console.log(`• Component with most total data: ${hierarchicalResults[0]['Component Type']} (${hierarchicalResults[0]['Total Data Points']} total points)`);
        
        const highestHierarchical = hierarchicalResults.reduce((max, d) => 
            d['Average Lead Time (weeks)'] > max['Average Lead Time (weeks)'] ? d : max);
        console.log(`• Highest rolled-up lead time: ${highestHierarchical['Component Type']} (${highestHierarchical['Average Lead Time (weeks)']} weeks)`);
        
        console.log(`\nTOP 10 INDIVIDUAL COMPONENTS BY DATA POINTS:`);
        console.log('Component Type'.padEnd(40) + 'Avg Lead Time'.padEnd(15) + 'Data Points');
        console.log('-'.repeat(70));
        for (let i = 0; i < Math.min(10, individualResults.length); i++) {
            const item = individualResults[i];
            const name = item['Component Type'].length > 35 ? 
                item['Component Type'].substring(0, 35) + '...' : item['Component Type'];
            console.log(name.padEnd(40) + 
                       `${item['Average Lead Time (weeks)']}w`.padEnd(15) + 
                       item['Data Points']);
        }
        
        console.log(`\nTOP 10 HIERARCHICAL COMPONENTS BY TOTAL DATA:`);
        console.log('Component Type'.padEnd(40) + 'Avg Lead Time'.padEnd(15) + 'Total Data'.padEnd(12) + 'Level');
        console.log('-'.repeat(75));
        for (let i = 0; i < Math.min(10, hierarchicalResults.length); i++) {
            const item = hierarchicalResults[i];
            const name = item['Component Type'].length > 35 ? 
                item['Component Type'].substring(0, 35) + '...' : item['Component Type'];
            console.log(name.padEnd(40) + 
                       `${item['Average Lead Time (weeks)']}w`.padEnd(15) + 
                       item['Total Data Points'].toString().padEnd(12) + 
                       item['Level']);
        }
    }

    exportToExcel(individualResults, hierarchicalResults) {
        const outputFile = 'lead_time_analysis_results.xlsx';
        console.log(`\nExporting results to ${outputFile}...`);
        
        try {
            const wb = XLSX.utils.book_new();
            
            // Individual components sheet
            const individualWS = XLSX.utils.json_to_sheet(individualResults);
            XLSX.utils.book_append_sheet(wb, individualWS, 'Individual Components');
            
            // Hierarchical analysis sheet
            const hierarchicalWS = XLSX.utils.json_to_sheet(hierarchicalResults);
            XLSX.utils.book_append_sheet(wb, hierarchicalWS, 'Hierarchical Analysis');
            
            // Summary sheet
            const summaryData = [
                { Metric: 'Total Individual Components', Value: individualResults.length },
                { Metric: 'Total Hierarchical Components', Value: hierarchicalResults.length },
                { Metric: 'Most Common Component', Value: `${individualResults[0]['Component Type']} (${individualResults[0]['Data Points']} quotes)` },
                { 
                    Metric: 'Highest Individual Lead Time', 
                    Value: `${individualResults.reduce((max, d) => d['Average Lead Time (weeks)'] > max['Average Lead Time (weeks)'] ? d : max)['Component Type']} (${Math.max(...individualResults.map(d => d['Average Lead Time (weeks)']))} weeks)` 
                },
                { 
                    Metric: 'Highest Hierarchical Lead Time', 
                    Value: `${hierarchicalResults.reduce((max, d) => d['Average Lead Time (weeks)'] > max['Average Lead Time (weeks)'] ? d : max)['Component Type']} (${Math.max(...hierarchicalResults.map(d => d['Average Lead Time (weeks)']))} weeks)` 
                }
            ];
            
            const summaryWS = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');
            
            XLSX.writeFile(wb, outputFile);
            console.log(`✓ Results exported to ${outputFile}`);
            return outputFile;
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            return null;
        }
    }

    async runAnalysis() {
        console.log('Starting Lead Time Analysis...\n');
        
        if (!(await this.loadData())) {
            return;
        }
        
        // Parse component types from quotes
        this.parseComponentTypes();
        
        // Build component hierarchy
        this.buildHierarchy();
        
        // Calculate individual component lead times
        const individualResults = this.calculateIndividualLeadTimes();
        
        // Calculate rolled-up hierarchical lead times
        const hierarchicalResults = this.calculateRolledUpLeadTimes();
        
        // Generate summary statistics
        this.generateSummaryStats(individualResults, hierarchicalResults);
        
        // Create visualizations
        this.createInteractiveHTML(individualResults, hierarchicalResults);
        
        // Export to Excel
        const excelFile = this.exportToExcel(individualResults, hierarchicalResults);
        
        console.log(`\n` + '='.repeat(80));
        console.log('ANALYSIS COMPLETE!');
        console.log('='.repeat(80));
        console.log('Files created:');
        console.log('• individual_component_lead_times.html - Interactive visualization');
        console.log('• hierarchical_lead_times.html - Interactive hierarchical visualization');
        if (excelFile) {
            console.log(`• ${excelFile} - Complete data export`);
        }
        
        return { individualResults, hierarchicalResults };
    }
}

// Run the analysis
const analyzer = new LeadTimeAnalyzer();
analyzer.runAnalysis().catch(console.error);
