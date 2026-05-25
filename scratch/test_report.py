import sys
import os
sys.path.append('c:/Users/INE/Documents/reductor_dias/backend')

import main
import pandas as pd

def run_test(stage, filename):
    print(f"\n=== TESTING STAGE {stage} WITH {filename} ===")
    filepath = os.path.join(main.DATASETS_DIR, filename)
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    main._clear_all_cache()
    main._active_file_path = filepath
    main._active_filename = filename
    main._active_stage = stage
    main._ensure_sheets()

    print("Available sheets in source dataset:", main._available_sheets)

    # Call the endpoint handler
    response = main.export_reductor_report(threshold=0.90, coverage=0.80)
    
    # Extract bytes from StreamingResponse
    excel_bytes = b""
    if hasattr(response, 'body_iterator'):
        import asyncio
        async def read_stream(iterator):
            b = b""
            async for chunk in iterator:
                b += chunk
            return b
        excel_bytes = asyncio.run(read_stream(response.body_iterator))
    else:
        excel_bytes = response.body

    # Save to disk
    output_path = f"c:/Users/INE/Documents/reductor_dias/scratch/test_output_etapa{stage}.xlsx"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(excel_bytes)
    print(f"Excel report saved to {output_path}")

    # Inspect the sheets in the generated Excel
    xls = pd.ExcelFile(output_path)
    print("Sheets in generated excel:", xls.sheet_names)
    for s_name in xls.sheet_names:
        df = pd.read_excel(output_path, sheet_name=s_name)
        print(f"  Sheet '{s_name}' has shape {df.shape}")
        print("  Columns:", list(df.columns))
        print("  First row preview:")
        if not df.empty:
            print(df.iloc[0].to_dict())
        else:
            print("  Empty sheet!")

if __name__ == "__main__":
    # Test Stage 1
    run_test(1, "PEC_2023-2024_1a.xlsx")
    # Test Stage 1 with file having only CCRL Requeridos
    run_test(1, "PEC_2017-2018_1a.xlsx")
    # Test Stage 2
    run_test(2, "PEC_2023-2024_2a.xlsx")
