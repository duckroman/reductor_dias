import pandas as pd

df = pd.read_excel('cumplimiento_completo_v1_poblado.xlsx', sheet_name=0, header=None)

print('=== HEADERS (fila 1) ===')
print(df.iloc[1, :].tolist())

print('\n=== PRIMERAS FILAS DE DATOS ===')
for i in range(2, 12):
    print(f'Fila {i}: {df.iloc[i, 0:5].tolist()}')

print(f'\n=== RESUMEN ===')
print(f'Total filas de datos: {len(df) - 2}')
print(f'Total columnas: {len(df.columns)}')

# Contar entidades únicas
entidades = df.iloc[2:, 1].dropna().unique()
print(f'Entidades únicas: {len(entidades)}')
print(f'Lista: {list(entidades[:10])}...')

# Contar distritos por entidad
dist_counts = df.iloc[2:, 1].value_counts()
print(f'\nDistritos por entidad (top 5):')
print(dist_counts.head())
