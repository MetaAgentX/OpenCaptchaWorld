"""
Simple CLI to drive the OpenCaptchaWorld benchmark with a browser-use agent.

Usage:
    python -m ocw_agent.cli --url http://127.0.0.1:5000 --llm browser-use --limit 3
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import textwrap
from typing import Callable, Optional

from browser_use import Agent, Browser


def _build_task_prompt(url: str, limit: int) -> str:
	"""
	Create the instruction string passed to the browser-use agent.

	Args:
	    url: Fully qualified URL pointing at a running OpenCaptchaWorld instance.
	    limit: Number of puzzles the agent should attempt before finishing.
	"""
	instructions = f"""
	You are evaluating Open CaptchaWorld puzzles hosted at {url}.

	Steps you must follow:
	1. Open {url} in a new tab. Dismiss any popups that might hide the puzzle.
	2. For each puzzle, read the requirements to understand what you need to solve.
	3. Use the "Submit" button to check your answer. When a new puzzle appears, continue with it.
	4. Stop after you have attempted {limit} puzzle(s) (count both successes and failures). When you have reached the limit or you are blocked, stop interacting with the page.
	5. At the end, return a short summary that lists the puzzle types you attempted and whether each was solved.

	Focus on solving the puzzles accurately. Avoid refreshing the page unless the interface becomes unresponsive.
	"""
	return textwrap.dedent(instructions).strip()


def _resolve_browser_use_client():
	"""
	Return ChatBrowserUse class, falling back to internal path for older releases.
	"""
	try:
		from browser_use import ChatBrowserUse  # type: ignore

		return ChatBrowserUse
	except ImportError as exc:  # Attribute missing or module not exposing class
		try:
			from browser_use.llm.browser_use.chat import ChatBrowserUse  # type: ignore

			return ChatBrowserUse
		except ImportError as inner_exc:
			raise ImportError(
				'ChatBrowserUse is not available in the installed browser-use package. '
				'Upgrade to the latest release (`pip install -U "browser-use[cli]"`).'
			) from inner_exc
	except Exception as exc:  # pragma: no cover - defensive
		raise ImportError('Failed to load ChatBrowserUse client') from exc


def _create_llm_factory() -> dict[str, Callable[[argparse.Namespace], object]]:
	"""Return a mapping from CLI option to LLM constructor callables."""

	def browser_use_factory(args: argparse.Namespace):
		try:
			ChatBrowserUse = _resolve_browser_use_client()
		except ImportError as exc:
			raise ValueError(str(exc)) from exc
		return ChatBrowserUse(fast=args.fast)

	def openai_factory(args: argparse.Namespace):
		from browser_use import ChatOpenAI

		model = args.model or 'gpt-4.1-mini'
		try:
			return ChatOpenAI(model=model)
		except TypeError as exc:
			raise ValueError(f'Invalid OpenAI configuration: {exc}') from exc

	def anthropic_factory(args: argparse.Namespace):
		from browser_use import ChatAnthropic

		model = args.model or 'claude-3-7-sonnet-20250219'
		try:
			return ChatAnthropic(model=model)
		except TypeError as exc:
			raise ValueError(f'Invalid Anthropic configuration: {exc}') from exc

	def google_factory(args: argparse.Namespace):
		from browser_use import ChatGoogle

		model = args.model or 'gemini-2.0-flash'
		try:
			return ChatGoogle(model=model)
		except TypeError as exc:
			raise ValueError(f'Invalid Google configuration: {exc}') from exc

	def groq_factory(args: argparse.Namespace):
		from browser_use import ChatGroq

		model = args.model or 'llama-3.1-70b-versatile'
		try:
			return ChatGroq(model=model)
		except TypeError as exc:
			raise ValueError(f'Invalid Groq configuration: {exc}') from exc

	def azure_factory(args: argparse.Namespace):
		from browser_use import ChatAzureOpenAI

		model = args.model
		if not model:
			raise ValueError('--model is required when using azure-openai (pass via --model)')
		try:
			return ChatAzureOpenAI(model=model)
		except TypeError as exc:
			raise ValueError(f'Invalid Azure OpenAI configuration: {exc}') from exc

	return {
		'browser-use': browser_use_factory,
		'openai': openai_factory,
		'anthropic': anthropic_factory,
		'google': google_factory,
		'groq': groq_factory,
		'azure-openai': azure_factory,
	}


def _configure_logging(verbose: bool) -> None:
	"""Set a minimal logging format for the CLI."""
	level = logging.DEBUG if verbose else logging.INFO
	logging.basicConfig(level=level, format='[%(levelname)s] %(message)s')


def _create_browser(args: argparse.Namespace) -> Browser | None:
	"""
	Create a Browser session if custom configuration is required.

	If no special flags are set, returning None lets browser-use create the default session.
	"""
	browser_kwargs: dict[str, object] = {}
	if args.use_cloud:
		browser_kwargs['use_cloud'] = True
	if args.headless:
		browser_kwargs['headless'] = True
	if args.window_width or args.window_height:
		width = args.window_width or 1280
		height = args.window_height or 720
		browser_kwargs['viewport'] = {'width': width, 'height': height}
		browser_kwargs['window_size'] = {'width': width, 'height': height}

	if not browser_kwargs:
		return None

	return Browser(**browser_kwargs)


async def _run_agent(args: argparse.Namespace) -> int:
	"""Run the browser-use agent with the provided CLI options."""
	llm_factories = _create_llm_factory()
	llm_name = args.llm.lower()

	if llm_name not in llm_factories:
		choices = ', '.join(sorted(llm_factories))
		raise ValueError(f'Unsupported llm "{args.llm}". Choose from: {choices}')

	llm = llm_factories[llm_name](args)
	browser = _create_browser(args)
	task = _build_task_prompt(args.url, args.limit)

	agent_kwargs = {}
	if args.max_failures is not None:
		agent_kwargs['max_failures'] = args.max_failures

	agent = Agent(
		task=task,
		llm=llm,
		browser=browser,
		max_actions_per_step=args.max_actions_per_step,
		include_tool_call_examples=False,
		**agent_kwargs,
	)

	if args.verbose:
		logging.getLogger('browser_use').setLevel(logging.DEBUG)

	try:
		history = await agent.run(max_steps=args.max_steps)
	except ValueError as exc:
		# Commonly raised when the chosen LLM requires API keys.
		logging.error(str(exc))
		return 1

	final_text = history.final_result()
	successful = history.is_successful()
	logging.info('Agent finished. success=%s', successful)
	if final_text:
		print('\nFinal summary:\n')
		print(final_text)
	else:
		print('\nAgent did not produce a final summary. Inspect history for details.')

	if history.usage and history.usage.total_cost is not None:
		logging.info('Approximate token cost: %s', history.usage.total_cost)

	return 0 if successful is not False else 1


def _build_parser() -> argparse.ArgumentParser:
	parser = argparse.ArgumentParser(description='Run a browser-use agent on Open CaptchaWorld puzzles.')
	llm_choices = sorted(_create_llm_factory().keys())
	parser.add_argument('--url', default='http://127.0.0.1:5000', help='URL of the running OpenCaptchaWorld instance.')
	parser.add_argument('--limit', type=int, default=265, help='Number of puzzle attempts before the agent stops.')
	parser.add_argument(
		'--llm',
		choices=llm_choices,
		default='browser-use',
		help='LLM backend to use.',
	)
	parser.add_argument('--model', help='Override the model name for the selected LLM (if supported).')
	parser.add_argument('--fast', action='store_true', help='Use the fast ChatBrowserUse model when --llm browser-use.')
	parser.add_argument('--max-steps', type=int, default=60, help='Maximum agent reasoning steps.')
	parser.add_argument(
		'--max-actions-per-step',
		type=int,
		default=10,
		help='Limit number of browser actions the agent may take per reasoning step.',
	)
	parser.add_argument('--max-failures', type=int, default=100, help='Consecutive failure limit before aborting.')
	parser.add_argument('--use-cloud', action='store_true', help='Launch the browser in the Browser Use Cloud.')
	parser.add_argument('--headless', action='store_true', help='Run the local browser in headless mode.')
	parser.add_argument('--window-width', type=int, help='Browser viewport width (pixels).')
	parser.add_argument('--window-height', type=int, help='Browser viewport height (pixels).')
	parser.add_argument('--verbose', action='store_true', help='Enable verbose logging.')
	return parser


def main(argv: Optional[list[str]] = None) -> int:
	parser = _build_parser()
	args = parser.parse_args(argv)
	_configure_logging(args.verbose)
	try:
		return asyncio.run(_run_agent(args))
	except KeyboardInterrupt:
		print('\nInterrupted by user.')
		return 1
	except Exception as exc:  # pylint: disable=broad-except
		logging.exception('Agent run failed: %s', exc)
		return 1


if __name__ == '__main__':
	raise SystemExit(main())
