import json
import pandas as pd

# Nombres del GeoJSON
with open('frontend/public/mexico_geo.json', 'r', encoding='utf-8') as f:
    geo = json.load(f)
geo_names = sorted([f['properties']['name'] for f in geo['features']])

# Nombres del Excel
df = pd.read_excel('cumplimiento_completo_v1_poblado.xlsx', sheet_name=0, header=1)
df.columns = [str(c).strip() for c in df.columns]
excel_names = sorted(df['Entidad'].dropna().unique().tolist())

print("GeoJSON names:")
for n in geo_names:
    print(f"  {n}")

print("\nExcel names:")
for n in excel_names:
    print(f"  {n}")

# Diferencias
geo_set = set(geo_names)
excel_set = set(excel_names)
print(f"\nEn GeoJSON pero no en Excel: {geo_set - excel_set}")
print(f"En Excel pero no en GeoJSON: {excel_set - geo_set}")
