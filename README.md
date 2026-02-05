# Student Engagement Detection System (EduMonitor)

A comprehensive AI-powered platform for monitoring student engagement and attendance in real-time.

## Prerequisites

Before running the project, ensure you have the following installed:

1.  **Python 3.10+**: [Download](https://www.python.org/downloads/)
2.  **Node.js 18+**: [Download](https://nodejs.org/)
3.  **PostgreSQL**: [Download](https://www.postgresql.org/download/)

---

## 1. Database Setup (PostgreSQL)

You need a running PostgreSQL instance.

1.  **Install PostgreSQL** from the link above and remember the password you set for the `postgres` user.
2.  **Create a Database**: Open pgAdmin or a terminal and run:
    ```sql
    CREATE DATABASE edumonitor;
    ```
3.  **Configure Backend**:
    *   Navigate to the `backend/` folder.
    *   Create a `.env` file (if it doesn't exist) or update it:
        ```env
        DATABASE_URL=postgresql://postgres:your_password@localhost/edumonitor
        SECRET_KEY=your_secret_key_here
        ALGORITHM=HS256
        ACCESS_TOKEN_EXPIRE_MINUTES=30
        ```
    *   *Replace `your_password` with your actual PostgreSQL password.*

---

## 2. Backend Setup

Open a terminal in the project root:

```bash
cd backend

# 1. Create a virtual environment
py -3.10 -m venv venv   

# 2. Activate the environment
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Initialize the Database
# This script drops existing tables and prepares for fresh migration
python reset_db.py

# 5. Start the Server
python main.py
```
*Backend runs on: http://localhost:8000*
*Swagger API Docs: http://localhost:8000/docs*

---

## 3. Frontend Setup

Open a **new** terminal in the project root:

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start the Development Server
npm run dev
```
*Frontend runs on: http://localhost:3000*

---

## 4. Default Login Credentials

The `reset_db.py` and initial run of `main.py` will seed the following default users:

| Role        | Username   | Password          |
| :---------- | :--------- | :---------------- |
| **Admin**   | `admin`    | `adminpassword`   |
| **Teacher** | `teacher1` | `teacherpassword` |
| **Student** | `student1` | `studentpassword` |

*Note: New registrations require Admin approval via the Admin Dashboard.*
