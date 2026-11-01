"""Configuration for pytest - adds app package to path"""
import sys
import os

# Add the project root to sys.path so `app` package is discoverable
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)