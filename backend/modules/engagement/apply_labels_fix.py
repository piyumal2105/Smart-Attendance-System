import pandas as pd
import os

def merge_labels():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    new_csv_path = os.path.join(BASE_DIR, "data", "labeled_dataset_new.csv")
    backup_csv_path = os.path.join(BASE_DIR, "data", "bak", "labeled_dataset_new.csv")

    print(f"Reading new data from: {new_csv_path}")
    print(f"Reading backup labels from: {backup_csv_path}")

    if not os.path.exists(new_csv_path) or not os.path.exists(backup_csv_path):
        print("Error: One or both files not found.")
        return

    df_new = pd.read_csv(new_csv_path)
    df_old = pd.read_csv(backup_csv_path)

    # Create a dictionary for quick lookup: (frame, student_id) -> label
    # We strip whitespace just in case
    label_map = {}
    for _, row in df_old.iterrows():
        try:
            # Check if label exists and is not NaN
            if pd.notna(row['label_engaged']) and str(row['label_engaged']).strip() != "":
                key = (int(row['frame']), int(row['student_id']))
                label_map[key] = row['label_engaged']
        except ValueError:
            continue
    
    print(f"Found {len(label_map)} labels in backup.")

    # Apply labels to new dataframe
    updated_count = 0
    for idx, row in df_new.iterrows():
        key = (int(row['frame']), int(row['student_id']))
        if key in label_map:
            df_new.at[idx, 'label_engaged'] = label_map[key]
            updated_count += 1

    print(f"Restored {updated_count} labels.")

    # Save back
    df_new.to_csv(new_csv_path, index=False)
    print(f"Saved updated file to {new_csv_path}")

if __name__ == "__main__":
    merge_labels()
