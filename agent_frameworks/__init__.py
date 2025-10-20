"""
Agent framework entry points for running OpenCaptchaWorld benchmarks.
"""

from .browseruse_cli import main as browseruse_main  # noqa: F401
from .crewai_cli import main as crewai_main  # noqa: F401

# Maintain backward compatibility: default `main` points to the browser-use CLI.
main = browseruse_main

__all__ = ["browseruse_main", "crewai_main", "main"]
