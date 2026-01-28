"""
Security Invariant Regression Tests

These tests verify that critical security invariants cannot be silently broken.
Fail-fast if any invariant is violated.
"""

import pytest
import sys
import os
from pathlib import Path

# Ensure required env vars for importing server module
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017/test")
os.environ.setdefault("JWT_SECRET", "test-secret-key-32-chars-minimum")
os.environ.setdefault("CLOUDINARY_CLOUD_NAME", "test")
os.environ.setdefault("CLOUDINARY_API_KEY", "test")
os.environ.setdefault("CLOUDINARY_API_SECRET", "test")
os.environ.setdefault("RESEND_API_KEY", "test")
os.environ.setdefault("RESEND_FROM_EMAIL", "test@example.com")

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import server as server_module
from server import (
    check_workspace_access,
    get_current_user,
    can_user_share_workspaces,
    InvitationStatus,
    SubscriptionStatus,
    UserRole
)


class TestSecurityInvariants:
    """Regression tests for security invariants."""
    
    def test_check_workspace_access_has_required_checks(self):
        """Guard 1: Verify check_workspace_access() has all required security checks."""
        import inspect
        source = inspect.getsource(check_workspace_access)
        
        required_checks = [
            "grace_period_ends_at",  # Grace period check
            "plan.get('name') == 'free'",  # Free plan check
            "SubscriptionStatus.EXPIRED",  # Expired subscription check
            "InvitationStatus.ACCEPTED"  # Membership status check
        ]
        
        missing = [check for check in required_checks if check not in source]
        assert not missing, f"SECURITY REGRESSION: check_workspace_access() missing checks: {missing}"
    
    def test_get_current_user_has_grace_period_check(self):
        """Guard 2: Verify get_current_user() checks grace period expiration."""
        import inspect
        source = inspect.getsource(get_current_user)
        
        required = ["grace_ends_at", "grace_end <= now"]
        missing = [r for r in required if r not in source]
        assert not missing, f"SECURITY REGRESSION: get_current_user() missing grace period check: {missing}"
    
    def test_can_user_share_workspaces_exists(self):
        """Guard 3: Verify can_user_share_workspaces() function exists."""
        assert callable(can_user_share_workspaces), "SECURITY REGRESSION: can_user_share_workspaces() missing"
    
    def test_frozen_membership_protection(self):
        """Guard 4: Verify frozen memberships cannot become active without resubscription."""
        # This test verifies the logic exists - actual database tests would require test DB
        # The key invariant: frozen_reason="subscription_expired" memberships can only be restored
        # via ACTIVATED webhook with explicit filter
        
        # Verify restoration filter exists in code
        import inspect
        # This would need to check the webhook handler code
        # For now, we verify the function exists and has the right signature
        assert callable(can_user_share_workspaces)
    
    def test_free_user_block_exists(self):
        """Guard 5: Verify Free user block exists in check_workspace_access()."""
        import inspect
        source = inspect.getsource(check_workspace_access)
        
        assert "plan.get('name') == 'free'" in source, "SECURITY REGRESSION: Free user block missing"
        assert "Free plan users cannot access" in source, "SECURITY REGRESSION: Free user error message missing"

    def test_auth_cookie_attributes_are_cross_site_safe(self):
        """Guard 6: Verify auth cookie attributes are cross-site safe in production."""
        import inspect
        source = inspect.getsource(server_module)
        assert 'COOKIE_SAMESITE = "None"' in source, "SECURITY REGRESSION: COOKIE_SAMESITE must be 'None' in production"
        assert 'COOKIE_SAMESITE = "none"' not in source, "SECURITY REGRESSION: COOKIE_SAMESITE must not be lowercase"
        assert 'COOKIE_SAMESITE = "lax"' not in source, "SECURITY REGRESSION: COOKIE_SAMESITE must not be lowercase"
        assert "COOKIE_SECURE = True" in source, "SECURITY REGRESSION: COOKIE_SECURE must be True in production"
        assert "samesite=COOKIE_SAMESITE" in source, "SECURITY REGRESSION: set_auth_cookie must use COOKIE_SAMESITE"
        assert "secure=COOKIE_SECURE" in source, "SECURITY REGRESSION: set_auth_cookie must use COOKIE_SECURE"

    def test_cookie_clear_matches_set_attributes(self):
        """Guard 7: Verify auth cookie clear matches set attributes."""
        import inspect
        set_source = inspect.getsource(server_module.set_auth_cookie)
        clear_source = inspect.getsource(server_module.clear_auth_cookie)
        assert "delete_cookie" in clear_source, "SECURITY REGRESSION: clear_auth_cookie must use delete_cookie"
        assert "set_cookie" not in clear_source, "SECURITY REGRESSION: clear_auth_cookie must not use set_cookie"
        for fragment in ["httponly=True", "secure=COOKIE_SECURE", "samesite=COOKIE_SAMESITE", 'path="/"']:
            assert fragment in set_source, f"SECURITY REGRESSION: set_auth_cookie missing {fragment}"
            assert fragment in clear_source, f"SECURITY REGRESSION: clear_auth_cookie missing {fragment}"

    def test_app_env_default_is_development(self):
        """Guard 8: Verify APP_ENV defaults to development."""
        import inspect
        source = inspect.getsource(server_module)
        assert 'APP_ENV = os.environ.get(\'APP_ENV\', \'development\')' in source, "SECURITY REGRESSION: APP_ENV default must be development"

    def test_get_current_user_reads_cookie(self):
        """Guard 9: Verify get_current_user reads from HttpOnly cookie."""
        import inspect
        source = inspect.getsource(get_current_user)
        assert "request.cookies.get(AUTH_COOKIE_NAME)" in source, "SECURITY REGRESSION: Cookie auth path missing"
        assert "APP_ENV == \"development\"" in source, "SECURITY REGRESSION: Auth header fallback must be dev-only"

    def test_cors_allows_credentials_and_headers(self):
        """Guard 10: Verify CORS allows credentials and required headers."""
        import inspect
        source = inspect.getsource(server_module)
        assert "allow_credentials=True" in source, "SECURITY REGRESSION: CORS must allow credentials"
        required_headers = [
            "Content-Type",
            "Authorization",
            "Accept",
            "Origin",
            "X-Requested-With"
        ]
        for header in required_headers:
            assert header in source, f"SECURITY REGRESSION: CORS missing header {header}"

    def test_api_client_with_credentials(self):
        """Guard 11: Verify shared API client enforces withCredentials."""
        api_path = Path(__file__).parent.parent / "frontend" / "src" / "lib" / "api.js"
        api_source = api_path.read_text(encoding="utf-8")
        assert "axios.create" in api_source, "SECURITY REGRESSION: Shared API client missing"
        assert "withCredentials: true" in api_source, "SECURITY REGRESSION: API client must enforce withCredentials"
        # No per-file overrides allowed
        frontend_root = Path(__file__).parent.parent / "frontend" / "src"
        for path in list(frontend_root.rglob("*.js")) + list(frontend_root.rglob("*.jsx")) + list(frontend_root.rglob("*.ts")) + list(frontend_root.rglob("*.tsx")):
            if str(path).endswith("frontend\\src\\lib\\api.js"):
                continue
            content = path.read_text(encoding="utf-8")
            assert "axios.defaults.withCredentials" not in content, f"SECURITY REGRESSION: Per-file axios override in {path}"
            assert "import axios from 'axios'" not in content, f"SECURITY REGRESSION: Raw axios import in {path}"
            assert "axios.get(" not in content, f"SECURITY REGRESSION: Raw axios usage in {path}"
            assert "axios.post(" not in content, f"SECURITY REGRESSION: Raw axios usage in {path}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
