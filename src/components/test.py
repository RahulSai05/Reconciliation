import pandas as pd
import os
import datetime
import tkinter as tk
from tkinter import filedialog

def select_file(title, prefix=None):
    """Opens a file dialog for the user to select a file and validates prefix if provided."""
    root = tk.Tk()
    root.withdraw()  # Hide the root window

    while True:
        print(f"\nSelect file for: {title}")
        file_path = filedialog.askopenfilename(
            title=f"Select {title}",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")]
        )
        if not file_path:
            print("No file selected. Please try again.")
            continue

        selected_file_name = os.path.basename(file_path)
        if prefix is None or (selected_file_name.startswith(prefix) and selected_file_name.endswith('.csv')):
            print(f"✅ Selected file: {file_path}")
            return file_path
        else:
            print(f"⚠️ Please select a file starting with: {prefix}" if prefix else "Invalid file. Please try again.")

if __name__ == "__main__":
    # Define file prefixes and titles
    file_titles = [
        "Shipment_History___Total",
        "EDIB2BiReportV2.csv",
        "EDI940Report_withCostV2.0"
    ]
    file_prefixes = [
        "Shipment_History___Total-",
        "EDIBB2iReportV2",
        "EDI940Report_withCostV2.0"
    ]

    # Select files using GUI
    selected_files = [select_file(title, prefix) for title, prefix in zip(file_titles, file_prefixes)]

    # Load files into DataFrames
    df1 = pd.read_csv(selected_files[0], low_memory=False)
    df2 = pd.read_csv(selected_files[1], low_memory=False)
    df3 = pd.read_csv(selected_files[2], low_memory=False)

    # Merge logic
    merged_df = pd.merge(df1, df2, how='left', left_on=['Pickticket'], right_on=['AXReferenceID'])
    merged_df.columns = merged_df.columns.str.strip()

    merged_df = merged_df[['Warehouse', 'Pickticket', 'Order', 'Drop Date', 'Ship Date', 'Ship To',
                           'Ship State', 'Zip Code', 'Customer PO', 'Ship Via', 'Load ID',
                           'Weight', 'SKU', 'Units', 'Price', 'Size Type', 'Size', 'Product Type',
                           'InvoiceNumber', 'StatusSummary', 'ERRORDESCRIPTION']]

    final_merge_df = pd.merge(merged_df, df3, how='left', left_on=['Pickticket'], right_on=['PickRoute'])
    final_merge_df = final_merge_df[['Pickticket', 'Warehouse', 'Order', 'Drop Date', 'Ship Date', 'Ship To',
                                     'Ship State', 'Zip Code', 'Customer PO', 'Ship Via', 'Load ID',
                                     'Weight', 'SKU', 'Units', 'Price', 'Size Type', 'Size', 'Product Type',
                                     'InvoiceNumber', 'StatusSummary', 'ERRORDESCRIPTION',
                                     'PickRoute', 'SalesHeaderStatus', 'SalesHeaderDocStatus',
                                     'PickModeOfDelivery', 'PickCreatedDate', 'DeliveryDate']]

    final_merge_df = final_merge_df.rename(columns={
        'InvoiceNumber': 'Received in EDI?',
        'StatusSummary': 'EDI Processing Status',
        'ERRORDESCRIPTION': 'EDI Message',
        'PickRoute': 'Found in AX DATa?'
    })

    # Filter data
    filtered_df = final_merge_df[
        (final_merge_df['SalesHeaderDocStatus'].isin(['Picking List'])) &
        (final_merge_df['EDI Processing Status'].isin(['AX Load Failure']))
    ]
    filtered_df = filtered_df.drop_duplicates(subset=['Pickticket'])
    print(filtered_df)

    # Save output
    current_date = datetime.datetime.now().strftime("%m%d%y")
    base_file_name = "MISSING_945_"
    target_folder = os.getcwd()  # Saves to current working directory
    file_name_with_date = f"{base_file_name}_{current_date}.xlsx"
    full_file_path = os.path.join(target_folder, file_name_with_date)

    filtered_df.to_excel(full_file_path, index=False)
    print(f"\n✅ DataFrame saved to {full_file_path}")
