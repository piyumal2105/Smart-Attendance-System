from database import engine, Base
from modules.auth import models

def reset_db():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Tables dropped. Restart main.py to recreate them.")

if __name__ == "__main__":
    reset_db()
