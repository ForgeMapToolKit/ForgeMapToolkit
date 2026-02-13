# Map Tool Suite

A desktop application for creating Supreme Commander Forged Alliance map scripts.

## Features

### 🗺️ Props Tab
- Place props on your map with visual preview
- Multi-select from prop libraries
- Coordinate mirroring (diagonal, horizontal, vertical)
- Blueprint path management
- Export to Lua scripts

### 💥 Wreckage Tab
- Place unit wreckage with custom emitters
- Random emitter selection from library
- Unit libraries with search functionality
- Map name integration for absolute paths
- Generate prop blueprints and scripts

### 🎨 Visual Editor
- Interactive map preview with canvas
- Click-to-place coordinates
- Color-coded markers per unit/prop type
- Real-time coordinate display
- Image upload for map reference

## Installation

### Requirements
- Windows 10 or later
- Node.js 16+ ([Download here](https://nodejs.org/))

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR-USERNAME/map-tool-suite.git
   cd map-tool-suite
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Start the application**
   ```bash
   npm run electron:dev
   ```

## Quick Start

### For End Users

1. Download the latest release
2. Run `install.bat` to install dependencies
3. Open CMD in the project folder
4. Run: `npm run build`
5. Run: `start.bat` to launch the application

See `INSTALLATION.txt` for detailed instructions.

## Usage

### Props Tab

1. Set your map size
2. Add prop names and blueprint paths
3. Click on the canvas to place coordinates
4. Select mirroring mode if needed
5. Generate files to export Lua scripts

### Wreckage Tab

1. Set map name and size
2. Add emitter paths (or use the library)
3. Add unit types
4. Place coordinates on the canvas
5. Generate wreckage props and scripts

## File Structure

```
map-tool-suite/
├── src/
│   ├── components/
│   │   └── tabs/
│   │       ├── PropsTab.jsx
│   │       ├── WreckageTab.jsx
│   │       └── ... (CSS files)
│   ├── App.jsx
│   └── main.jsx
├── electron/
│   └── main.js
├── public/
├── install.bat
├── start.bat
└── README.md
```

## Libraries

The application supports JSON libraries for:
- **Unit Libraries**: Categorized units with previews
- **Emitter Libraries**: Emitter paths with names
- **Blueprint Libraries**: Props with paths and previews

Upload your library JSON files through the Library buttons in each tab.

## Development

### Available Scripts

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run electron:dev` - Start Electron app
- `npm run electron:build` - Build Electron distributable

### Tech Stack

- **Frontend**: React + Vite
- **Desktop**: Electron
- **Styling**: CSS
- **File Generation**: JSZip

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Your License Here]

## Credits

Created for the Supreme Commander Forged Alliance mapping community.

## Support

For issues and questions, please open an issue on GitHub.
