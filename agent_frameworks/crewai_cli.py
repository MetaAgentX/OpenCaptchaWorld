"""
Command line helper that runs OpenCaptchaWorld puzzles through a CrewAI agent.

Example:
    python -m agent_frameworks.crewai_cli --url http://127.0.0.1:5000 --limit 3
"""

from __future__ import annotations

import argparse
import logging
import textwrap
from typing import Optional


def _configure_logging(verbose: bool) -> None:
	"""Configure basic logging for the CLI."""
	level = logging.DEBUG if verbose else logging.INFO
	logging.basicConfig(level=level, format='[%(levelname)s] %(message)s')


def _import_crewai_components():
	"""Import CrewAI classes lazily so the module loads even without the dependency."""
	try:
		from crewai import Agent, Crew, Process, Task
	except ImportError as exc:  # pragma: no cover - dependency error path
		raise ImportError(
			'CrewAI is required for this CLI. Install it with `pip install crewai`.'
		) from exc
	except Exception as exc:  # pragma: no cover - dependency error path
		# CrewAI (and LangChain) currently rely on Pydantic v1, which is incompatible with Python 3.14+.
		message = str(exc)
		if 'pydantic' in message.lower() or 'llm_output' in message or 'ConfigError' in message:
			raise ImportError(
				'CrewAI currently depends on Pydantic v1, which is incompatible with Python 3.14. '
				'Use Python 3.13 or earlier (for example 3.11/3.12) when running the CrewAI CLI.'
			) from exc
		raise
	return Agent, Crew, Process, Task


def _import_browser_tool():
	"""Import the CrewAI browser tool lazily."""
	try:
		from crewai_tools import BrowserTool
	except ImportError as exc:  # pragma: no cover - dependency error path
		raise ImportError(
			'BrowserTool from `crewai-tools` is required. Install it with `pip install "crewai-tools[playwright]"`.'
		) from exc
	return BrowserTool


def _resolve_llm(provider: str, model: Optional[str], temperature: float):
	"""Return a LangChain-compatible chat model for the requested provider."""
	provider = provider.lower()

	if provider == 'openai':
		try:
			from langchain_openai import ChatOpenAI
		except ImportError as exc:  # pragma: no cover - dependency error path
			raise ImportError(
				'Provider "openai" requires `langchain-openai`. Install it with `pip install langchain-openai`.'
			) from exc

		return ChatOpenAI(model=model or 'gpt-4o-mini', temperature=temperature)

	if provider == 'anthropic':
		try:
			from langchain_anthropic import ChatAnthropic
		except ImportError as exc:  # pragma: no cover - dependency error path
			raise ImportError(
				'Provider "anthropic" requires `langchain-anthropic`. Install it with `pip install langchain-anthropic`.'
			) from exc

		return ChatAnthropic(model=model or 'claude-3-7-sonnet-20250219', temperature=temperature)

	if provider == 'google':
		try:
			from langchain_google_genai import ChatGoogleGenerativeAI
		except ImportError as exc:  # pragma: no cover - dependency error path
			raise ImportError(
				'Provider "google" requires `langchain-google-genai`. Install it with `pip install langchain-google-genai`.'
			) from exc

		return ChatGoogleGenerativeAI(model=model or 'gemini-2.0-flash', temperature=temperature)

	if provider == 'groq':
		try:
			from langchain_groq import ChatGroq
		except ImportError as exc:  # pragma: no cover - dependency error path
			raise ImportError(
				'Provider "groq" requires `langchain-groq`. Install it with `pip install langchain-groq`.'
			) from exc

		return ChatGroq(model=model or 'llama-3.1-70b-versatile', temperature=temperature)

	if provider == 'azure-openai':
		try:
			from langchain_openai import AzureChatOpenAI
		except ImportError as exc:  # pragma: no cover - dependency error path
			raise ImportError(
				'Provider "azure-openai" requires `langchain-openai`. Install it with `pip install langchain-openai`.'
			) from exc

		if not model:
			raise ValueError('--model is required when using provider "azure-openai". Provide your deployment name.')

		return AzureChatOpenAI(deployment_name=model, temperature=temperature)

	raise ValueError(f'Unsupported provider "{provider}".')


def _build_task_description(url: str, limit: int) -> str:
	"""Return the instruction block fed into the CrewAI task."""
	return textwrap.dedent(
		f"""
		You are evaluating CAPTCHA-style puzzles on the OpenCaptchaWorld benchmark site located at {url}.

		Instructions:
		1. Use the BrowserTool to open {url} and load the page fully.
		2. Read the puzzle instructions and inspect the image or widget shown.
		3. Interact with the puzzle directly in the browser (clicking, typing, dragging, or rotating as required).
		4. After submitting each answer, record the puzzle type, the response you provided, and whether it was accepted.
		5. Repeat until you have attempted {limit} puzzle(s), then stop interacting with the page.
		6. Summarize your findings and provide a structured report of every attempt you made.

		Be proactive about zooming in or scrolling where necessary, and avoid refreshing the page unless it becomes unresponsive.
		"""
	).strip()


def _expected_output_schema(limit: int) -> str:
	"""Provide guidance on the expected response format."""
	return textwrap.dedent(
		f"""
		Return a JSON object with the following structure:
		{{
		  "attempts": [
		    {{
		      "index": <number 1..{limit}>,
		      "puzzle_type": "<name extracted from the UI>",
		      "answer": "<the value or action you provided>",
		      "correct": <true|false>,
		      "notes": "<short explanation of what happened>"
		    }},
		    ...
		  ],
		  "summary": "<two to three sentence wrap-up of overall performance>"
		}}
		"""
	).strip()


def _extract_output(result) -> str:
	"""
	Normalize CrewAI results to a plain string.

	The return value from `Crew.kickoff()` varies slightly across versions, so we
	try a few common attributes before falling back to `str(result)`.
	"""
	if result is None:
		return ''

	if isinstance(result, str):
		return result

	for attr in ('output', 'raw', 'response', 'final_output'):
		if hasattr(result, attr):
			value = getattr(result, attr)
			if value:
				return value

	if hasattr(result, 'tasks_output'):
		try:
			outputs = getattr(result, 'tasks_output')
			if isinstance(outputs, list) and outputs:
				last = outputs[-1]
				if hasattr(last, 'raw'):
					return last.raw
				if hasattr(last, 'output'):
					return last.output
		except Exception:  # pragma: no cover - best effort extraction
			pass

	if hasattr(result, 'to_dict'):
		try:
			data = result.to_dict()
			if isinstance(data, dict):
				for key in ('output', 'raw', 'response'):
					if key in data and data[key]:
						return data[key]
				return str(data)
		except Exception:  # pragma: no cover - best effort extraction
			pass

	return str(result)


def _run_crewai(args: argparse.Namespace) -> str:
	"""Execute the CrewAI workflow and return the final string output."""
	Agent, Crew, Process, Task = _import_crewai_components()
	BrowserTool = _import_browser_tool()

	llm = _resolve_llm(args.provider, args.model, args.temperature)
	browser_tool = BrowserTool()

	agent = Agent(
		role='CAPTCHA Solver',
		goal=f'Solve up to {args.limit} puzzles on the OpenCaptchaWorld benchmark accurately.',
		backstory=(
			'You are an evaluation agent focused on understanding challenging CAPTCHA-like puzzles. '
			'You can browse the target website, interpret visual content, and interact with the UI to submit answers.'
		),
		tools=[browser_tool],
		verbose=args.verbose,
		allow_delegation=False,
		llm=llm,
	)

	task = Task(
		description=_build_task_description(args.url, args.limit),
		expected_output=_expected_output_schema(args.limit),
		agent=agent,
	)

	crew = Crew(
		agents=[agent],
		tasks=[task],
		process=Process.sequential,
		verbose=args.verbose,
	)

	result = crew.kickoff()
	return _extract_output(result)


def _build_parser() -> argparse.ArgumentParser:
	"""Create the CLI argument parser."""
	parser = argparse.ArgumentParser(description='Run OpenCaptchaWorld puzzles using a CrewAI agent.')
	parser.add_argument('--url', default='http://127.0.0.1:5000', help='URL of the running OpenCaptchaWorld instance.')
	parser.add_argument('--limit', type=int, default=3, help='Number of puzzle attempts before the agent stops.')
	parser.add_argument(
		'--provider',
		choices=['openai', 'anthropic', 'google', 'groq', 'azure-openai'],
		default='openai',
		help='LLM provider to back the CrewAI agent.',
	)
	parser.add_argument('--model', help='Optional model override for the selected provider.')
	parser.add_argument('--temperature', type=float, default=0.2, help='Sampling temperature for the LLM.')
	parser.add_argument('--verbose', action='store_true', help='Enable verbose logging from CrewAI.')
	return parser


def main(argv: Optional[list[str]] = None) -> int:
	parser = _build_parser()
	args = parser.parse_args(argv)
	_configure_logging(args.verbose)

	try:
		output = _run_crewai(args)
	except (ImportError, ValueError) as exc:
		logging.error(str(exc))
		return 1
	except Exception as exc:  # pragma: no cover - runtime errors
		logging.exception('CrewAI agent run failed: %s', exc)
		return 1

	if output:
		print(output)
	else:
		logging.warning('CrewAI agent did not return any output.')

	return 0


if __name__ == '__main__':
	raise SystemExit(main())
