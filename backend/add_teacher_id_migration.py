"""
Add teacher_id column to existing attendance_sessions table
"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def add_teacher_column():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        # Check if column exists
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='attendance_sessions' 
            AND column_name='teacher_id';
        """)
        
        if cur.fetchone():
            print("✅ teacher_id column already exists!")
            return
        
        # Add teacher_id column
        cur.execute("""
            ALTER TABLE attendance_sessions 
            ADD COLUMN teacher_id INTEGER;
        """)
        
        # Add foreign key constraint
        cur.execute("""
            ALTER TABLE attendance_sessions 
            ADD CONSTRAINT fk_teacher_id 
            FOREIGN KEY (teacher_id) REFERENCES users(id);
        """)
        
        # Add index
        cur.execute("""
            CREATE INDEX idx_sessions_teacher_id 
            ON attendance_sessions(teacher_id);
        """)
        
        conn.commit()
        print("✅ teacher_id column added successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        print("\nTry running this SQL manually in your database:")
        print("ALTER TABLE attendance_sessions ADD COLUMN teacher_id INTEGER;")
        print("ALTER TABLE attendance_sessions ADD CONSTRAINT fk_teacher_id FOREIGN KEY (teacher_id) REFERENCES users(id);")
        print("CREATE INDEX idx_sessions_teacher_id ON attendance_sessions(teacher_id);")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    add_teacher_column()