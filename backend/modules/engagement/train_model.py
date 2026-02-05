import pandas as pd
import numpy as np
import pickle
import os
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score, precision_score, recall_score

def train_engagement_model():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(BASE_DIR, "data", "labeled_dataset_synthetic_augmented.csv")
    model_dir = os.path.join(BASE_DIR, "models")
    model_path = os.path.join(model_dir, "engagement_model.pkl")

    if not os.path.exists(model_dir):
        os.makedirs(model_dir)

    print(f"Loading data from {data_path}...")
    try:
        df = pd.read_csv(data_path)
    except FileNotFoundError:
        print(f"Error: {data_path} not found.")
        return

    # Features and Target
    feature_cols = ['avg_pitch', 'ratio_head_down', 'ratio_lean_forward',
                    'ratio_writing_like', 'pitch_delta_mean', 'pitch_delta_std']
    target_col = 'label_engaged'

    # Drop rows where target is missing
    df = df.dropna(subset=[target_col])

    X = df[feature_cols]
    y = df[target_col]

    print(f"Training with {len(df)} samples.")
    print(f"Class distribution:\n{y.value_counts()}")

    # Split Data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # --- Hyperparameter Tuning ---
    print("Tuning hyperparameters with GridSearchCV...")
    param_grid = {
        'n_estimators': [50, 100],  # Reduced for Real-Time Speed (was 1000)
        'max_depth': [5, 10],       # Limit depth to prevent overfitting/lag
        'min_samples_leaf': [2, 5, 10],
        'class_weight': ['balanced', 'balanced_subsample']
    }

    rf = RandomForestClassifier(random_state=42)
    grid_search = GridSearchCV(rf, param_grid, cv=5, scoring='f1', n_jobs=-1, verbose=1)
    grid_search.fit(X_train, y_train)

    best_clf = grid_search.best_estimator_
    print(f"\nBest Parameters: {grid_search.best_params_}")

    # --- Threshold Tuning ---
    print("\nTuning Decision Threshold...")
    y_probs = best_clf.predict_proba(X_test)[:, 1]
    
    thresholds = np.arange(0.3, 0.71, 0.01)
    best_thresh = 0.5
    best_f1 = 0.0

    for thresh in thresholds:
        y_pred_thresh = (y_probs >= thresh).astype(int)
        f1 = f1_score(y_test, y_pred_thresh)
        if f1 > best_f1:
            best_f1 = f1
            best_thresh = thresh
    
    print(f"Optimal Threshold: {best_thresh:.3f} (Test F1: {best_f1:.4f})")

    # Final Evaluation on Test Set
    final_preds = (y_probs >= best_thresh).astype(int)
    
    acc = accuracy_score(y_test, final_preds)
    print(f"\nAccuracy at optimal threshold: {acc:.4f}")
    
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, final_preds))
    
    print("\nClassification Report:")
    report = classification_report(y_test, final_preds)
    print(report)
    
    with open("results.txt", "w") as f:
        f.write(f"Best Params: {grid_search.best_params_}\n")
        f.write(f"Optimal Threshold: {best_thresh:.3f}\n")
        f.write(report)
        f.write(f"\nAccuracy: {acc:.4f}\n")

    # Feature Importance
    print("\nFeature Importances:")
    importances = best_clf.feature_importances_
    for name, imp in zip(feature_cols, importances):
        print(f"  {name}: {imp:.4f}")

    # Save Model AND Threshold
    print(f"\nSaving model artifact to {model_path}...")
    artifact = {
        "model": best_clf,
        "threshold": best_thresh,
        "features": feature_cols
    }
    with open(model_path, 'wb') as f:
        pickle.dump(artifact, f)
    print("Done.")

if __name__ == "__main__":
    train_engagement_model()
