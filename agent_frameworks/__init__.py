"""
OpenCaptchaWorld agent helpers built on top of browser-use.

This package currently exposes a minimal CLI that instructs a browser-use
agent to open an OpenCaptchaWorld deployment and attempt the puzzles.
"""

from .browseruse_cli import main  # noqa: F401

__all__ = ["main"]
