import sys
sys.path.append('backend')
import analysis
import numpy as np

sheets = analysis.get_sheet_names()
print(f"Hojas encontradas: {sheets}")

for s in sheets:
    try:
        df = analysis.load_data(sheet_name=s)
        m, c = analysis.get_data_matrix(df)
        dist_list = df['Distrito'].tolist()
        print(f"Hoja: {s}, Matrix Shape: {m.shape}, First 5 Dists: {dist_list[:5]}")
        if 'base_dists' not in locals():
            base_dists = dist_list
        else:
            if dist_list != base_dists:
                print(f"  ¡ADVERTENCIA! El orden de los distritos en {s} no coincide con la primera hoja.")
            else:
                print(f"  Orden de distritos coincidente.")
    except Exception as e:
        print(f"Error en hoja {s}: {e}")
