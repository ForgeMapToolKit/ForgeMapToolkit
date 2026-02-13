const fs = require('fs');
const path = require('path');

// Konfiguration
const BLUEPRINT_ROOT = path.join(__dirname, 'prop_blueprint_library');
const PREVIEW_ROOT = path.join(__dirname, 'public', 'assets', 'prop_blueprint_preview');
const OUTPUT_FILE = path.join(__dirname, 'prop_library.json');

/**
 * Scannt rekursiv nach .bp Dateien und lädt zugehörige PNG-Previews
 */
function scanPropsFolder(dirPath, category, subcategory = '') {
    const props = [];
    
    try {
        if (!fs.existsSync(dirPath)) {
            console.warn(`Ordner existiert nicht: ${dirPath}`);
            return props;
        }

        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            
            if (item.isDirectory()) {
                // Rekursiv in Unterordner (trees, bush, rocks, etc.)
                const subProps = scanPropsFolder(fullPath, category, item.name);
                props.push(...subProps);
            } else if (item.isFile() && item.name.endsWith('_prop.bp')) {
                // Blueprint-Datei gefunden
                const baseName = item.name.replace('_prop.bp', '');
                const previewFileName = `${baseName}_albedo.png`;
                const previewPath = path.join(PREVIEW_ROOT, previewFileName);
                
                // Prüfe ob Preview-PNG existiert
                let previewData = null;
                if (fs.existsSync(previewPath)) {
                    try {
                        // Lade PNG als Base64
                        const imageBuffer = fs.readFileSync(previewPath);
                        previewData = `data:image/png;base64,${imageBuffer.toString('base64')}`;
                    } catch (error) {
                        console.warn(`  Warnung: Konnte Preview nicht laden: ${previewFileName}`);
                    }
                }
                
                // Generiere den Game-Path (beginnt mit /env)
                const relativePath = path.relative(BLUEPRINT_ROOT, dirPath);
                // Ersetze Backslashes durch Forward-Slashes und füge /env am Anfang hinzu
                const gamePath = `/env/${relativePath}`.replace(/\\/g, '/');
                
                props.push({
                    name: `${baseName}_prop`,
                    preview: previewData,  // Base64-encoded PNG oder null
                    previewFile: previewFileName,  // Dateiname für Referenz
                    path: gamePath,
                    category: category,
                    subcategory: subcategory || null,
                    blueprintFile: item.name
                });
            }
        }
    } catch (error) {
        console.error(`Fehler beim Scannen von ${dirPath}:`, error.message);
    }
    
    return props;
}

/**
 * Hauptfunktion: Scannt alle Kategorien
 */
function buildPropLibrary() {
    const library = {
        generated: new Date().toISOString(),
        categories: []
    };
    
    try {
        // Prüfe ob Blueprint-Root existiert
        if (!fs.existsSync(BLUEPRINT_ROOT)) {
            console.error(`FEHLER: Ordner nicht gefunden: ${BLUEPRINT_ROOT}`);
            console.log('\nBitte stelle sicher, dass folgende Struktur existiert:');
            console.log('C:\\map-tool-suite\\');
            console.log('├── prop_blueprint_library\\');
            console.log('│   ├── kategorie1\\');
            console.log('│   │   └── props\\');
            console.log('│   └── kategorie2\\');
            console.log('│       └── props\\');
            console.log('└── scan_libraries.js');
            process.exit(1);
        }

        // Prüfe ob Preview-Root existiert
        if (!fs.existsSync(PREVIEW_ROOT)) {
            console.warn(`\nWARNUNG: Preview-Ordner nicht gefunden: ${PREVIEW_ROOT}`);
            console.warn('Previews werden nicht geladen.\n');
        } else {
            const previewCount = fs.readdirSync(PREVIEW_ROOT).filter(f => f.endsWith('.png')).length;
            console.log(`Preview-Ordner gefunden mit ${previewCount} PNG-Dateien\n`);
        }

        // Lese alle Kategorien (Unterordner in prop_blueprint_library)
        const categories = fs.readdirSync(BLUEPRINT_ROOT, { withFileTypes: true })
            .filter(item => item.isDirectory());
        
        console.log(`Gefundene Kategorien: ${categories.length}`);
        console.log(`Blueprint Root: ${BLUEPRINT_ROOT}`);
        console.log(`Preview Root: ${PREVIEW_ROOT}\n`);
        
        let totalProps = 0;
        let propsWithPreviews = 0;
        
        for (const category of categories) {
            const categoryPath = path.join(BLUEPRINT_ROOT, category.name);
            const propsPath = path.join(categoryPath, 'props');
            
            console.log(`Scanne Kategorie: ${category.name}`);
            
            // Prüfe ob 'props' Ordner existiert
            if (!fs.existsSync(propsPath)) {
                console.warn(`  ⚠ Kein 'props' Ordner gefunden in '${category.name}'`);
                continue;
            }
            
            // Scanne alle Props in dieser Kategorie
            const props = scanPropsFolder(propsPath, category.name);
            
            if (props.length > 0) {
                const withPreview = props.filter(p => p.preview !== null).length;
                propsWithPreviews += withPreview;
                totalProps += props.length;
                
                library.categories.push({
                    name: category.name,
                    count: props.length,
                    props: props
                });
                
                console.log(`  ✓ ${props.length} Props gefunden (${withPreview} mit Preview)`);
            } else {
                console.log(`  ⚠ Keine Props gefunden`);
            }
        }
        
        // Schreibe JSON-Datei
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(library, null, 2), 'utf8');
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✓ Library erfolgreich generiert: ${OUTPUT_FILE}`);
        console.log(`${'='.repeat(60)}`);
        console.log(`  Kategorien: ${library.categories.length}`);
        console.log(`  Gesamt Props: ${totalProps}`);
        console.log(`  Props mit Preview: ${propsWithPreviews}`);
        console.log(`  Props ohne Preview: ${totalProps - propsWithPreviews}`);
        console.log(`${'='.repeat(60)}\n`);
        
        // Zeige Beispiel-Ausgabe
        if (library.categories.length > 0 && library.categories[0].props.length > 0) {
            console.log('Beispiel-Eintrag:');
            const example = library.categories[0].props[0];
            console.log(JSON.stringify({
                name: example.name,
                previewFile: example.previewFile,
                preview: example.preview ? `[Base64 Image Data - ${Math.round(example.preview.length / 1024)}KB]` : null,
                path: example.path,
                category: example.category,
                subcategory: example.subcategory
            }, null, 2));
        }
        
    } catch (error) {
        console.error('Fehler beim Erstellen der Library:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Script ausführen
console.log('='.repeat(60));
console.log('      PROP LIBRARY GENERATOR WITH PNG PREVIEWS');
console.log('='.repeat(60));
console.log(`Arbeitsverzeichnis: ${__dirname}\n`);
buildPropLibrary();