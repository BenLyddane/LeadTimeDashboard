# Lead Time Analysis Dashboard

A comprehensive dashboard for analyzing historical lead times across component types and manufacturers.

## Features

- **Interactive Charts**: Plotly.js powered visualizations
- **Component Analysis**: Track lead time trends by component type
- **Manufacturer Analysis**: Monitor supplier performance over time
- **Heatmap View**: Visual representation of lead time patterns
- **Responsive Design**: Works on desktop and mobile devices

## Live Demo

The dashboard is deployed on Vercel at: [Your Vercel URL will appear here after deployment]

## Local Development

1. Clone this repository
2. Open `index.html` in your browser
3. The dashboard runs entirely in the browser with no backend required

## Data Analysis Scripts

The project includes Node.js scripts for data processing:

```bash
npm install
npm run analyze        # Run lead time analysis
npm run historical     # Generate historical analysis
```

## Deployment

### Deploy to Vercel

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Follow the prompts**:
   - Set up and deploy
   - Link to existing project or create new
   - Confirm deployment

### Manual Deployment

Alternatively, you can deploy via the Vercel website:

1. Go to [vercel.com](https://vercel.com)
2. Import your repository
3. Vercel will automatically detect and deploy your static site

## Project Structure

```
├── index.html                          # Main dashboard (deployed as root)
├── historical_lead_time_dashboard.html # Original dashboard file
├── vercel.json                         # Vercel configuration
├── package.json                        # Node.js dependencies
├── lead_time_analysis.js               # Data analysis script
├── historical_lead_time_analyzer.js    # Historical analysis script
├── manufacturer_standardizer.js        # Manufacturer data processing
└── data files...                       # CSV and other data files
```

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Charts**: Plotly.js
- **Deployment**: Vercel
- **Data Processing**: Node.js

## License

MIT License
