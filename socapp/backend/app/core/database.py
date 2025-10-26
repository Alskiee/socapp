from neo4j import GraphDatabase
from app.core.config import settings

class Neo4jConnection:
    def __init__(self):
        # Replace neo4j+s:// with neo4j+ssc:// for self-signed certificates
        uri = settings.NEO4J_URI.replace("neo4j+s://", "neo4j+ssc://")
        
        print(f"Connecting to: {uri}")  # Debug output
        
        self.driver = GraphDatabase.driver(
            uri,
            auth=(settings.auth_user, settings.NEO4J_PASSWORD)
        )
        
        # Test connection immediately
        try:
            self.driver.verify_connectivity()
            print("✅ Successfully connected to Neo4j Aura")
        except Exception as e:
            print(f"❌ Connection failed: {e}")
            # Don't raise immediately, let the app start and try connection on first request
            # This helps with temporary network issues

    def close(self):
        self.driver.close()

    def get_session(self):
        return self.driver.session(database=settings.NEO4J_DATABASE)

db = Neo4jConnection()