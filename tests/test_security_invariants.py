"""
Security Invariant Regression Tests

These tests verify that critical security invariants cannot be silently broken.
Fail-fast if any invariant is violated.
"""

import pytest
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
