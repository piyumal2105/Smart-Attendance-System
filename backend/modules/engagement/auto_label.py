import pandas as pd
import os

def auto_label_dataset():
    # Load dataset
    csv_path = "backend/modules/engagement/data/labeled_dataset_new.csv"
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return

    print(f"Loading {csv_path}...")
    df = pd.read_csv(csv_path)

    print("Applying heuristics...")
    count = 0
    for index, row in df.iterrows():
        # Positive Engagement Strategy:
        # Default to 0 (Not Engaged) unless we see positive evidence.
        
        new_label = 0
        
        # 1. Writing
        if row['ratio_writing_like'] > 0.8:
            new_label = 1
        
        # 2. Looking Up (Valid Data)
        # We enforce avg_pitch > 0.1 to avoid the 0.0 default clump.
        elif row['avg_pitch'] > 0.1 and row['avg_pitch'] < 10.0:
            new_label = 1
            
        df.at[index, 'label_engaged'] = int(new_label)
        count += 1

    print(f"Auto-labeled {count} rows.")

    # Save back
    df.to_csv(csv_path, index=False)
    print(f"Saved to {csv_path}")

    # Show distribution
    print("\nNew Label Distribution:")
    print(df['label_engaged'].value_counts())

if __name__ == "__main__":
    auto_label_dataset()
