"""Emit the deterministic OpenAPI document used by the mobile client generator."""

import json

from givehub.main import app

print(json.dumps(app.openapi(), sort_keys=True))

