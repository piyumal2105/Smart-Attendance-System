import pandas as pd
import os

def apply_interval_labels():
    # Paths
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATASET_PATH = os.path.join(BASE_DIR, "data", "labeled_dataset_new.csv")
    INTERVALS_PATH = os.path.join(BASE_DIR, "data", "interval_labels.csv")

    if not os.path.exists(INTERVALS_PATH):
        print(f"Error: {INTERVALS_PATH} not found.")
        return

    if not os.path.exists(DATASET_PATH):
        print(f"Error: {DATASET_PATH} not found.")
        return

    print("Loading files...")
    df_data = pd.read_csv(DATASET_PATH)
    df_intervals = pd.read_csv(INTERVALS_PATH)

    print(f"Loaded {len(df_data)} dataset rows.")
    print(f"Loaded {len(df_intervals)} label intervals.")

    count_updated = 0

    # Iterate through each interval rule
    for _, rule in df_intervals.iterrows():
        s_id = rule['student_id']
        label = int(rule['label'])
        
        # Check if user is using Frames or Time
        if 'start_frame' in rule and not pd.isna(rule['start_frame']):
            # Frame Logic
            f_start = int(rule['start_frame'])
            f_end = int(rule['end_frame'])
            
            mask = (df_data['student_id'] == s_id) & \
                   (df_data['frame'] >= f_start) & \
                   (df_data['frame'] <= f_end)
            
            criteria_str = f"Frames {f_start}-{f_end}"
            
        else:
            # Time Logic
            t_start = float(rule['start_time'])
            t_end = float(rule['end_time'])

            mask = (df_data['student_id'] == s_id) & \
                   (df_data['time_sec'] >= t_start) & \
                   (df_data['time_sec'] <= t_end)
                   
            criteria_str = f"Time {t_start}s-{t_end}s"
        
        # Update label
        rows_to_update = df_data.loc[mask]
        if not rows_to_update.empty:
            df_data.loc[mask, 'label_engaged'] = label
            count_updated += len(rows_to_update)
            print(f"Applied Label {label} to Student {s_id} for {criteria_str} ({len(rows_to_update)} rows).")

    # Save back
    df_data.to_csv(DATASET_PATH, index=False)
    print("------------------------------------------------")
    print(f"Success! Updated {count_updated} rows in '{DATASET_PATH}'.")
    print("You can now run 'train_model.py' to use these new labels.")

if __name__ == "__main__":
    apply_interval_labels()
