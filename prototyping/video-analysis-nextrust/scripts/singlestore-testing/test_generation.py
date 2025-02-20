import mysql.connector
from faker import Faker
import uuid
import random
import json
import numpy as np
from datetime import datetime, timedelta

class SingleStoreTest:
    def __init__(self):
      self.fake = Faker()
      try:
        self.conn = mysql.connector.connect(
            host='127.0.0.1',      # Use localhost IP
            port=3306,             # Port exposed by Docker
            user='root',
            password='D05DEBCE669719CCB810CB3E3F29964C326C3E88 ',       # Use your actual password, not the hash
            database='video_analysis',
            connect_timeout=30
        )
        print("Connection successful!")
      except Exception as e:
          print(f"Connection error: {e}")
          print("Please verify:")
          print("1. SingleStore container is running")
          print("2. Port 3306 is exposed")
          print("3. Password is correct")
          print(f"4. Container status: {self.check_container_status()}")
      
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
        base_timestamp = datetime.now()
        
        for i in range(num_frames):
            # Simulate embedding vector (384 dimensions)
            embedding = np.random.rand(384).tobytes()
            
            frame = {
                'video_id': video_id,
                'frame_number': i,
                'timestamp': float(i),
                'frame_path': f"/frames/{video_id}/frame_{i:04d}.jpg",
                'embedding': embedding,
                'metadata': json.dumps({
                    'quality_score': random.uniform(0.5, 1.0),
                    'brightness': random.uniform(0.0, 1.0),
                    'motion_score': random.uniform(0.0, 1.0)
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
                VALUES (%(id)s, %(filename)s, %(status)s, %(metadata)s)
            """
            self.cursor.executemany(video_query, videos)

            # Insert frames for each video
            frame_query = """
                INSERT INTO frames (video_id, frame_number, timestamp, frame_path, embedding, metadata)
                VALUES (%(video_id)s, %(frame_number)s, %(timestamp)s, %(frame_path)s, %(embedding)s, %(metadata)s)
            """
            for video in videos:
                frames = self.generate_frame_data(video['id'], frames_per_video)
                self.cursor.executemany(frame_query, frames)

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
                SELECT id, metadata->>'$.resolution' as resolution 
                FROM videos 
                LIMIT 5
            """)
            print("Sample video resolutions:")
            for vid_id, resolution in self.cursor.fetchall():
                print(f"Video {vid_id}: {resolution}")

            # Test frame distribution
            print("\nFrames per video:")
            self.cursor.execute("""
                SELECT video_id, COUNT(*) as frame_count 
                FROM frames 
                GROUP BY video_id 
                LIMIT 5
            """)
            for vid_id, count in self.cursor.fetchall():
                print(f"Video {vid_id}: {count} frames")

        except Exception as e:
            print(f"Error running test queries: {e}")

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
        """Close database connection"""
        self.cursor.close()
        self.conn.close()

if __name__ == "__main__":
    # Create test instance
    test = SingleStoreTest()

    try:
        # Run tests
        print("Starting SingleStore tests...")
        
        # Insert test data
        test.insert_test_data(num_videos=5, frames_per_video=10)
        
        # Run test queries
        test.run_test_queries()
        
        # Optional: Cleanup test data
        # test.cleanup()

    finally:
        # Close connection
        test.close()
        print("Tests completed!")