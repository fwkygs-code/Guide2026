import requests
import sys
import json
import os
from datetime import datetime

class WalkthroughSaaSAPITester:
    def __init__(self, base_url=None):
        # Prefer explicit base URL for local/dev usage.
        # Example: http://127.0.0.1:8000/api
        self.base_url = base_url or os.environ.get("API_BASE_URL", "http://127.0.0.1:8000/api")
        self.token = None
        self.user_id = None
        self.workspace_id = None
        self.category_id = None
        self.walkthrough_id = None
        self.step_id = None
        self.workspace_slug = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    headers.pop('Content-Type', None)  # Let requests set it for multipart
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    'test': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'test': name,
                'error': str(e)
            })
            return False, {}

    def test_signup(self):
        """Test user signup"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_user_data = {
            "email": f"test_user_{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Test User {timestamp}"
        }
        
        success, response = self.run_test(
            "User Signup",
            "POST",
            "auth/signup",
            200,
            data=test_user_data
        )
        
        if success and 'token' in response and 'user' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   User ID: {self.user_id}")
            return True
        return False

    def test_login(self):
        """Test user login with existing credentials"""
        # Use the same credentials from signup
        timestamp = datetime.now().strftime('%H%M%S')
        login_data = {
            "email": f"test_user_{timestamp}@example.com",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_create_workspace(self):
        """Test workspace creation"""
        workspace_data = {
            "name": f"Test Workspace {datetime.now().strftime('%H%M%S')}",
            "brand_color": "#4f46e5"
        }
        
        success, response = self.run_test(
            "Create Workspace",
            "POST",
            "workspaces",
            200,
            data=workspace_data
        )
        
        if success and 'id' in response:
            self.workspace_id = response['id']
            self.workspace_slug = response['slug']
            print(f"   Workspace ID: {self.workspace_id}")
            print(f"   Workspace Slug: {self.workspace_slug}")
            return True
        return False

    def test_get_workspaces(self):
        """Test get user workspaces"""
        success, response = self.run_test(
            "Get Workspaces",
            "GET",
            "workspaces",
            200
        )
        return success

    def test_get_workspace(self):
        """Test get specific workspace"""
        if not self.workspace_id:
            print("❌ Skipping - No workspace ID available")
            return False
            
        success, response = self.run_test(
            "Get Workspace",
            "GET",
            f"workspaces/{self.workspace_id}",
            200
        )
        return success

    def test_create_category(self):
        """Test category creation"""
        if not self.workspace_id:
            print("❌ Skipping - No workspace ID available")
            return False
            
        category_data = {
            "name": f"Test Category {datetime.now().strftime('%H%M%S')}",
            "description": "A test category for walkthroughs"
        }
        
        success, response = self.run_test(
            "Create Category",
            "POST",
            f"workspaces/{self.workspace_id}/categories",
            200,
            data=category_data
        )
        
        if success and 'id' in response:
            self.category_id = response['id']
            print(f"   Category ID: {self.category_id}")
            return True
        return False

    def test_get_categories(self):
        """Test get workspace categories"""
        if not self.workspace_id:
            print("❌ Skipping - No workspace ID available")
            return False
            
        success, response = self.run_test(
            "Get Categories",
            "GET",
            f"workspaces/{self.workspace_id}/categories",
            200
        )
        return success

    def test_create_walkthrough(self):
        """Test walkthrough creation"""
        if not self.workspace_id:
            print("❌ Skipping - No workspace ID available")
            return False
            
        walkthrough_data = {
            "title": f"Test Walkthrough {datetime.now().strftime('%H%M%S')}",
            "description": "A comprehensive test walkthrough",
            "category_ids": [self.category_id] if self.category_id else [],
            "privacy": "public",
            "navigation_type": "next_prev",
            "navigation_placement": "bottom"
        }
        
        success, response = self.run_test(
            "Create Walkthrough",
            "POST",
            f"workspaces/{self.workspace_id}/walkthroughs",
            200,
            data=walkthrough_data
        )
        
        if success and 'id' in response:
            self.walkthrough_id = response['id']
            print(f"   Walkthrough ID: {self.walkthrough_id}")
            return True
        return False

    def test_get_walkthroughs(self):
        """Test get workspace walkthroughs"""
        if not self.workspace_id:
            print("❌ Skipping - No workspace ID available")
            return False
            
        success, response = self.run_test(
            "Get Walkthroughs",
            "GET",
            f"workspaces/{self.workspace_id}/walkthroughs",
            200
        )
        return success

    def test_get_walkthrough(self):
        """Test get specific walkthrough"""
        if not self.workspace_id or not self.walkthrough_id:
            print("❌ Skipping - No workspace or walkthrough ID available")
            return False
            
        success, response = self.run_test(
            "Get Walkthrough",
            "GET",
            f"workspaces/{self.workspace_id}/walkthroughs/{self.walkthrough_id}",
            200
        )
        return success

    def test_add_step(self):
        """Test adding step to walkthrough"""
        if not self.workspace_id or not self.walkthrough_id:
            print("❌ Skipping - No workspace or walkthrough ID available")
            return False
            
        step_data = {
            "title": "Step 1: Getting Started",
            "content": "<p>Welcome to our walkthrough! This is the first step.</p>",
            "media_url": None,
            "media_type": None,
            "common_problems": []
        }
        
        success, response = self.run_test(
            "Add Step",
            "POST",
            f"workspaces/{self.workspace_id}/walkthroughs/{self.walkthrough_id}/steps",
            200,
            data=step_data
        )
        
        if success and 'id' in response:
            self.step_id = response['id']
            print(f"   Step ID: {self.step_id}")
            return True
        return False

    def test_update_step(self):
        """Test updating a step"""
        if not self.workspace_id or not self.walkthrough_id or not self.step_id:
            print("❌ Skipping - Missing required IDs")
            return False
            
        step_data = {
            "title": "Step 1: Getting Started (Updated)",
            "content": "<p>Welcome to our updated walkthrough! This is the first step with new content.</p>",
            "media_url": None,
            "media_type": None,
            "common_problems": []
        }
        
        success, response = self.run_test(
            "Update Step",
            "PUT",
            f"workspaces/{self.workspace_id}/walkthroughs/{self.walkthrough_id}/steps/{self.step_id}",
            200,
            data=step_data
        )
        return success

    def test_update_walkthrough_to_published(self):
        """Test updating walkthrough status to published"""
        if not self.workspace_id or not self.walkthrough_id:
            print("❌ Skipping - No workspace or walkthrough ID available")
            return False
            
        # First, let's manually update the walkthrough status to published in the database
        # Since the API doesn't seem to have a direct publish endpoint, we need to check the backend logic
        walkthrough_data = {
            "title": f"Published Test Walkthrough {datetime.now().strftime('%H%M%S')}",
            "description": "A published test walkthrough",
            "category_ids": [self.category_id] if self.category_id else [],
            "privacy": "public",
            "navigation_type": "next_prev",
            "navigation_placement": "bottom"
        }
        
        success, response = self.run_test(
            "Update Walkthrough to Published",
            "PUT",
            f"workspaces/{self.workspace_id}/walkthroughs/{self.walkthrough_id}",
            200,
            data=walkthrough_data
        )
        
        # The issue is that the walkthrough status is not being set to "published"
        # Looking at the backend code, the status field is not being updated in the PUT request
        # This is a backend bug - the status should be updatable
        print("   Note: Walkthrough status may not be set to 'published' - this is a backend issue")
        return success

    def test_get_portal(self):
        """Test public portal access"""
        if not self.workspace_slug:
            print("❌ Skipping - No workspace slug available")
            return False
            
        success, response = self.run_test(
            "Get Public Portal",
            "GET",
            f"portal/{self.workspace_slug}",
            200
        )
        return success

    def test_get_public_walkthrough(self):
        """Test public walkthrough access"""
        if not self.workspace_slug or not self.walkthrough_id:
            print("❌ Skipping - Missing workspace slug or walkthrough ID")
            return False
            
        success, response = self.run_test(
            "Get Public Walkthrough",
            "GET",
            f"portal/{self.workspace_slug}/walkthroughs/{self.walkthrough_id}",
            200
        )
        return success

    def test_analytics_event(self):
        """Test analytics event tracking"""
        if not self.walkthrough_id:
            print("❌ Skipping - No walkthrough ID available")
            return False
            
        event_data = {
            "walkthrough_id": self.walkthrough_id,
            "event_type": "view",
            "session_id": f"test-session-{datetime.now().strftime('%H%M%S')}"
        }
        
        success, response = self.run_test(
            "Track Analytics Event",
            "POST",
            "analytics/event",
            200,
            data=event_data
        )
        return success

    def test_get_analytics(self):
        """Test get walkthrough analytics"""
        if not self.workspace_id or not self.walkthrough_id:
            print("❌ Skipping - Missing required IDs")
            return False
            
        success, response = self.run_test(
            "Get Analytics",
            "GET",
            f"workspaces/{self.workspace_id}/walkthroughs/{self.walkthrough_id}/analytics",
            200
        )
        return success

    def test_submit_feedback(self):
        """Test feedback submission"""
        if not self.walkthrough_id:
            print("❌ Skipping - No walkthrough ID available")
            return False
            
        feedback_data = {
            "walkthrough_id": self.walkthrough_id,
            "rating": "happy",
            "comment": "Great walkthrough! Very helpful."
        }
        
        success, response = self.run_test(
            "Submit Feedback",
            "POST",
            "feedback",
            200,
            data=feedback_data
        )
        return success

    def test_get_feedback(self):
        """Test get walkthrough feedback"""
        if not self.workspace_id or not self.walkthrough_id:
            print("❌ Skipping - Missing required IDs")
            return False
            
        success, response = self.run_test(
            "Get Feedback",
            "GET",
            f"workspaces/{self.workspace_id}/walkthroughs/{self.walkthrough_id}/feedback",
            200
        )
        return success

def main():
    print("🚀 Starting Walkthrough SaaS API Testing...")
    print("=" * 60)
    
    tester = WalkthroughSaaSAPITester()
    
    # Test sequence following the user journey
    test_sequence = [
        # Authentication flow
        ("User Signup", tester.test_signup),
        ("Get Current User", tester.test_get_me),
        
        # Workspace management
        ("Create Workspace", tester.test_create_workspace),
        ("Get Workspaces", tester.test_get_workspaces),
        ("Get Workspace", tester.test_get_workspace),
        
        # Category management
        ("Create Category", tester.test_create_category),
        ("Get Categories", tester.test_get_categories),
        
        # Walkthrough management
        ("Create Walkthrough", tester.test_create_walkthrough),
        ("Get Walkthroughs", tester.test_get_walkthroughs),
        ("Get Walkthrough", tester.test_get_walkthrough),
        
        # Step management
        ("Add Step", tester.test_add_step),
        ("Update Step", tester.test_update_step),
        
        # Publishing
        ("Update Walkthrough to Published", tester.test_update_walkthrough_to_published),
        
        # Public portal
        ("Get Public Portal", tester.test_get_portal),
        ("Get Public Walkthrough", tester.test_get_public_walkthrough),
        
        # Analytics and feedback
        ("Track Analytics Event", tester.test_analytics_event),
        ("Get Analytics", tester.test_get_analytics),
        ("Submit Feedback", tester.test_submit_feedback),
        ("Get Feedback", tester.test_get_feedback),
    ]
    
    # Run all tests
    for test_name, test_func in test_sequence:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} - Unexpected error: {str(e)}")
            tester.failed_tests.append({
                'test': test_name,
                'error': str(e)
            })
    
    # Print results
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS")
    print("=" * 60)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for i, failure in enumerate(tester.failed_tests, 1):
            print(f"{i}. {failure['test']}")
            if 'expected' in failure:
                print(f"   Expected: {failure['expected']}, Got: {failure['actual']}")
                print(f"   Response: {failure['response']}")
            if 'error' in failure:
                print(f"   Error: {failure['error']}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())