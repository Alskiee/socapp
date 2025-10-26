# College Social Media Backend

**Tech Stack:** FastAPI + Neo4j AuraDB

## Project Structure
```
backend/
  app/
    core/
      config.py
      security.py
      database.py
    models/
      user.py
      post.py
    schemas/
      user_schema.py
      post_schema.py
    routes/
      auth.py
      users.py
      posts.py
    main.py
  .env
  requirements.txt
  README.md
```

## Setup
1. Create a `.env` file (see example below)
2. Create and activate a virtual environment
3. Install dependencies
4. Run the API

### .env example
```
NEO4J_URI=neo4j+s://<your-aura-uri>
NEO4J_USER=<username>
NEO4J_PASSWORD=<password>
JWT_SECRET=supersecretkey
JWT_ALGORITHM=HS256
```

### Install dependencies
```bash
pip install -r requirements.txt
```

### Run
```bash
uvicorn app.main:app --reload
```

### Notes
- Ensure your Neo4j AuraDB instance is running and the creds match `.env`.
- Endpoints:
  - POST `/auth/register`
  - POST `/auth/login`
  - GET `/users/`
  - POST `/posts/`
  - GET `/posts/`
- Root endpoint: GET `/` returns a welcome message.
