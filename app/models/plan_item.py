# Backwards-compatibility alias for legacy PlanItem references
from app.models.plan import Plan

PlanItem = Plan

__all__ = ["PlanItem"]
