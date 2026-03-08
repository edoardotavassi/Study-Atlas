<h1 align="center">
  Study Atlas
</h1>

<p align="center">
  <strong>A modern, local-first study tracker with an AI-powered tutor built-in.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/svelte-ff3e00?style=for-the-badge&logo=svelte&logoColor=white" alt="Svelte" />
  <img src="https://img.shields.io/badge/tauri-24c8db?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri" />
  <img src="https://img.shields.io/badge/tailwindcss-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/sqlite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
</p>

## Overview

Study Atlas is a desktop application designed to help students track their study sessions, manage subjects, and visualize their progress. It goes beyond basic time tracking by integrating an **AI Study Tutor** (powered locally by Ollama) that can review your performance, suggest daily study plans, and actively modify your schedule based on conversation.

Because it's built with Tauri, all your data—including your database and AI prompts—stays 100% local on your machine.

## Features

- **⏱️ Study Session Tracking**: Log your exact focus levels, duration, and topics covered. Choose between manual logging or using the live pomodoro-style timer.
- **📅 Smart Daily Plans**: Automatic daily study plans built by the AI based on your weekly goals and forgotten subjects.
- **🤖 Live AI Tutor**: Chat directly with an LLM that knows your exact study metrics. Ask it to lighten your load, and it will rewrite your plan for the day seamlessly.
- **📊 Deep Insights**: Visual breakdown of your performance, subject balance, "stuck rates" (friction), and daily consistency.
- **🔒 100% Local**: Powered by a local SQLite database and local LLMs (via Ollama). No cloud syncing, no data harvesting.

## Technology Stack

- **Frontend**: [Svelte 5](https://svelte.dev/) (with SvelteKit)
- **Desktop Framework**: [Tauri v2](https://v2.tauri.app/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: SQLite (via `tauri-plugin-sql`)
- **AI Integration**: Custom SSE client connecting to local [Ollama](https://ollama.com/) instances

## Prerequisites

To build and run Study Atlas locally, you need:

1. **Node.js** (v18+)
2. **Rust** and Cargo (required by Tauri)
3. **Ollama** (optional, but required for AI features like the Tutor and Smart Plans)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/exam-tracker.git
   cd exam-tracker
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npx tauri dev
   ```
   This command starts the Vite dev server and opens the native Tauri window.

## Using the AI Features

To unlock the AI Tutor and Smart Planner, make sure you have [Ollama](https://ollama.com/) installed and running locally.

1. Start Ollama.
2. Pull a fast reasoning model, for example `qwen3:4b` or `llama3.2:3b`.
   ```bash
   ollama pull qwen
   ```
3. Open Study Atlas, go to **Settings**, and ensure your LLM configuration points to `http://localhost:11434/v1/chat/completions` with your chosen model name.

## Build for Production

To compile a standalone executable for your operating system:

```bash
npx tauri build
```

The resulting binaries will be located in `src-tauri/target/release/bundle/`.

## License

This project is licensed under the MIT License.
