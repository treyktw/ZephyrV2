import mysql.connector
from faker import Faker
import uuid
import random
import json
import numpy as np
from datetime import datetime, timedelta
import base64  # Add this to imports

class SingleStoreTest:
    def __init__(self):
        self.fake = Faker()
        self.conn = None
        self.cursor = None
        try:
            self.conn = mysql.connector.connect(
                host='127.0.0.1',
                port=3306,
                user='root',
                password='password',
                database='video_analysis',
                connect_timeout=30
            )
            print("Connection successful!")
            # Initialize cursor after successful connection
            self.cursor = self.conn.cursor()
            print("Cursor initialized!")

            # Verify we can execute queries
            self.cursor.execute("SELECT 1")
            result = self.cursor.fetchone()
            print(f"Test query result: {result}")

        except mysql.connector.Error as err:
            print(f"Database error: {err}")
            # Clean up if connection was established but cursor failed
            if self.conn is not None:
                self.conn.close()
                self.conn = None
        except Exception as e:
            print(f"Other error: {e}")
            if self.conn is not None:
                self.conn.close()
                self.conn = None

    def check_container_status(self):
        try:
            import subprocess
            result = subprocess.run(['docker', 'ps'], capture_output=True, text=True)
            return result.stdout
        except Exception as e:
            return f"Could not check container status: {e}"

    def generate_video_data(self, num_videos=5):
        """Generate sample video entries"""
        videos = []
        statuses = ['uploading', 'processing', 'complete', 'error']

        for _ in range(num_videos):
            video = {
                'id': str(uuid.uuid4()),
                'filename': f"{self.fake.word()}_video_{random.randint(1,1000)}.mp4",
                'status': random.choice(statuses),
                'metadata': json.dumps({
                    'duration': random.randint(30, 3600),
                    'resolution': random.choice(['720p', '1080p', '4K']),
                    'fps': random.choice([24, 30, 60]),
                    'size': random.randint(1000000, 100000000)
                })
            }
            videos.append(video)
        return videos

    def generate_frame_data(self, video_id, num_frames=10):
        """Generate sample frame entries for a video"""
        frames = []
        for i in range(num_frames):
            # Generate embedding data as base64 string
            embedding = base64.b64encode(
                bytes([random.randint(0, 255) for _ in range(384)])
            ).decode('utf-8')

            frame = {
                'video_id': video_id,
                'frame_number': i,
                'timestamp': float(i),
                'frame_path': f"/frames/{video_id}/frame_{i:04d}.jpg",
                'embedding': embedding,  # Now it's base64 encoded
                'metadata': json.dumps({
                    'quality_score': round(random.uniform(0.5, 1.0), 2),
                    'brightness': round(random.uniform(0.0, 1.0), 2),
                    'motion_score': round(random.uniform(0.0, 1.0), 2)
                })
            }
            frames.append(frame)
        return frames

    def insert_test_data(self, num_videos=5, frames_per_video=10):
        """Insert test data into database"""
        try:
            # Insert videos
            videos = self.generate_video_data(num_videos)
            video_query = """
                INSERT INTO videos (id, filename, status, metadata)
                VALUES (%s, %s, %s, %s)
            """
            video_data = [(v['id'], v['filename'], v['status'], v['metadata']) for v in videos]
            self.cursor.executemany(video_query, video_data)

            # Insert frames for each video
            frame_query = """
                INSERT INTO frames (video_id, frame_number, timestamp, frame_path, embedding, metadata)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            for video in videos:
                frames = self.generate_frame_data(video['id'], frames_per_video)
                frame_data = [
                    (f['video_id'], f['frame_number'], f['timestamp'],
                     f['frame_path'], f['embedding'], f['metadata'])
                    for f in frames
                ]
                self.cursor.executemany(frame_query, frame_data)

            self.conn.commit()
            print(f"Successfully inserted {num_videos} videos with {frames_per_video} frames each")

        except Exception as e:
            self.conn.rollback()
            print(f"Error inserting test data: {e}")

    def run_test_queries(self):
        """Run various test queries"""
        try:
            # Test basic video queries
            print("\nTesting video queries:")
            self.cursor.execute("SELECT COUNT(*) FROM videos")
            print(f"Total videos: {self.cursor.fetchone()[0]}")

            # Test status distribution
            self.cursor.execute("SELECT status, COUNT(*) FROM videos GROUP BY status")
            print("\nStatus distribution:")
            for status, count in self.cursor.fetchall():
                print(f"{status}: {count}")

            # Test frame queries
            print("\nTesting frame queries:")
            self.cursor.execute("SELECT COUNT(*) FROM frames")
            print(f"Total frames: {self.cursor.fetchone()[0]}")

            # Test JSON queries
            print("\nTesting JSON metadata queries:")
            self.cursor.execute("""
                SELECT id, JSON_EXTRACT_JSON(metadata, '$.resolution') as resolution
                FROM videos
                LIMIT 5
            """)
            print("Sample video resolutions:")
            for vid_id, resolution in self.cursor.fetchall():
                print(f"Video {vid_id}: {resolution}")

            print("\nTesting embedding storage:")
            self.cursor.execute("""
                SELECT id, video_id, LENGTH(embedding) as emb_length
                FROM frames
                LIMIT 5
            """)
            print("Sample embedding lengths:")
            for frame_id, video_id, emb_length in self.cursor.fetchall():
                print(f"Frame {frame_id} (Video {video_id}): {emb_length} bytes")

        except Exception as e:
            print(f"Error running test queries: {e}")


    def create_tables(self):
        """Create necessary tables if they don't exist"""
        try:
            create_videos_table = """
            CREATE TABLE IF NOT EXISTS videos (
                id VARCHAR(36) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                status VARCHAR(20) NOT NULL,
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            """

            create_frames_table = """
            CREATE TABLE IF NOT EXISTS frames (
                id BIGINT NOT NULL AUTO_INCREMENT,
                video_id VARCHAR(36) NOT NULL,
                frame_number INT NOT NULL,
                timestamp DECIMAL(10,3) NOT NULL,
                frame_path VARCHAR(255) NOT NULL,
                embedding VARBINARY(1536),
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            """

            self.cursor.execute(create_videos_table)
            self.cursor.execute(create_frames_table)
            self.conn.commit()
            print("Tables created successfully")
        except Exception as e:
            print(f"Error creating tables: {e}")
            raise

    def cleanup(self):
        """Clean up test data"""
        try:
            self.cursor.execute("DELETE FROM frames")
            self.cursor.execute("DELETE FROM videos")
            self.conn.commit()
            print("Test data cleaned up successfully")
        except Exception as e:
            self.conn.rollback()
            print(f"Error cleaning up test data: {e}")


    def close(self):
        """Safely close database connections"""
        try:
            if self.cursor is not None:
                self.cursor.close()
            if self.conn is not None:
                self.conn.close()
            print("Database connections closed successfully")
        except Exception as e:
            print(f"Error closing connections: {e}")

    def ensure_database_exists(self):
        """Ensure the video_analysis database exists"""
        try:
            # Create a connection without specifying database
            temp_conn = mysql.connector.connect(
                host='127.0.0.1',
                port=3306,
                user='root',
                password='password'
            )
            temp_cursor = temp_conn.cursor()

            # Create database if it doesn't exist
            temp_cursor.execute("CREATE DATABASE IF NOT EXISTS video_analysis")
            temp_cursor.execute("USE video_analysis")
            print("Database video_analysis ready")

            # Create tables if they don't exist
            self.create_tables()

            temp_cursor.close()
            temp_conn.close()
        except Exception as e:
            print(f"Error ensuring database exists: {e}")
            raise

    def create_tables(self):
        """Create necessary tables if they don't exist"""
        try:
            create_videos_table = """
            CREATE TABLE IF NOT EXISTS videos (
                id VARCHAR(36) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                status VARCHAR(20) NOT NULL,
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            """

            create_frames_table = """
            CREATE TABLE IF NOT EXISTS frames (
                id BIGINT NOT NULL AUTO_INCREMENT,
                video_id VARCHAR(36) NOT NULL,
                frame_number INT NOT NULL,
                timestamp DECIMAL(10,3) NOT NULL,
                frame_path VARCHAR(255) NOT NULL,
                embedding TEXT,  # Changed from VARBINARY to TEXT for base64
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            )
            """

            self.cursor.execute(create_videos_table)
            self.cursor.execute(create_frames_table)
            self.conn.commit()
            print("Tables created successfully")
        except Exception as e:
            print(f"Error creating tables: {e}")
            raise

    def cleanup_database(self):
        """Clean up all test data from the database"""
        try:
            print("\nCleaning up database...")

            # Disable foreign key checks temporarily
            self.cursor.execute("SET FOREIGN_KEY_CHECKS = 0")

            # Truncate tables
            self.cursor.execute("TRUNCATE TABLE frames")
            self.cursor.execute("TRUNCATE TABLE videos")

            # Re-enable foreign key checks
            self.cursor.execute("SET FOREIGN_KEY_CHECKS = 1")

            self.conn.commit()
            print("Database cleaned successfully!")

            # Verify cleanup
            self.cursor.execute("SELECT COUNT(*) FROM videos")
            videos_count = self.cursor.fetchone()[0]
            self.cursor.execute("SELECT COUNT(*) FROM frames")
            frames_count = self.cursor.fetchone()[0]

            print(f"Verification - Videos: {videos_count}, Frames: {frames_count}")

        except Exception as e:
            print(f"Error during cleanup: {e}")
            self.conn.rollback()


if __name__ == "__main__":
    test = None
    try:
        # Create test instance
        test = SingleStoreTest()

        # Ensure database and tables exist
        test.ensure_database_exists()

        print("Starting SingleStore tests...")

        # Insert test data
        test.insert_test_data(num_videos=5, frames_per_video=10)

        # Run test queries
        test.run_test_queries()

        test = SingleStoreTest()
        test.cleanup_database()
        test.close()

    except Exception as e:
        print(f"Test execution error: {e}")
    finally:
        # Safely close connections
        if test is not None:
            test.close()
