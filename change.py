import json
import os
import base64

# Pfade anpassen
INPUT_JSON = './unit_library.json'
OUTPUT_JSON = './unit_library_base64.json'
PREVIEW_FOLDER = r"C:/map-tool-suite/public/assets/wreckage_unit_preview"

# JSON laden
with open(INPUT_JSON, 'r', encoding='utf-8') as f:
    data = json.load(f)

def png_to_base64(file_path):
    """Liest PNG und gibt Base64-String zurück"""
    with open(file_path, 'rb') as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
    # Für Browser: data URI hinzufügen
    return f"data:image/png;base64,{encoded}"

# Alle Units durchlaufen
for category in data.get('categories', []):
    for unit in category.get('units', []):
        unit_id = unit['id'].lower()
        png_path = os.path.join(PREVIEW_FOLDER, f"{unit_id}.png")
        
        if os.path.exists(png_path):
            unit['preview'] = png_to_base64(png_path)
        else:
            print(f"⚠️ Preview fehlt: {unit_id}.png")
            unit['preview'] = None  # oder leerer String

# Ergebnis speichern
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"✅ Alle Previews in Base64 umgewandelt und gespeichert in {OUTPUT_JSON}")