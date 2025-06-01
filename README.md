<p align="center">
  <a href="https://github.com/Yaxin9Luo/Open_CaptchaWorld">
    <img src="./assets/band_image.png" style="height: 10em" alt="Open CaptchaWorld" />
  </a>
</p>
<div align="center">

[![Open In Spaces](https://img.shields.io/badge/🤗-Open%20In%20Spaces-blue)](https://huggingface.co/spaces/YaxinLuo/Open_CaptchaWorld)
[![Dataset](https://img.shields.io/badge/%F0%9F%93%A6-dataset-orange)](https://huggingface.co/datasets/YaxinLuo/Open_CaptchaWorld)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-orange)
[![Python](https://img.shields.io/badge/python-3.10%2B-blue)](https://www.python.org/downloads/release/python-3100/)

</div>



A comprehensive web-based platform for testing and benchmarking Multimodal LLM Web Agents on CAPTCHA-style puzzles. This project provides an environment to evaluate how artificial intelligence systems perform on a variety of visual puzzles resembling CAPTCHAs (Completely Automated Public Turing tests to tell Computers and Humans Apart). 

Based on our research paper: **"Open CaptchaWorld: A Comprehensive Web-based Platform for Testing and Benchmarking Multimodal LLM Agents"**. Below are some examples from our Open CaptchaWorld.

<div align="center">
  <img src="./assets/captcha_example.png" alt="CAPTCHA Demo" width="800px">
</div>

## 📰 News

* [2025-05-29] ✅ We have released the first version of <span style="color:#00ffff; font-weight:bold;">**Open CaptchaWorld**</span> Benchmark and Dataset.

## 📋 Table of Contents

- [🌟 Overview](#-overview)
- [🎬 Demo](#-demo)
- [🎯 Motivation & Contributions](#-motivation--contributions)
- [✨ Features](#-features)
- [🏗 Project Structure](#-project-structure)
- [🧩 CAPTCHA Types](#-captcha-types)
- [📊 Benchmark Results](#-benchmark-results)
- [🚀 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [📝 Usage](#-usage)
  - [Web Interface](#web-interface)
- [🗺️ Future Plan](#️-future-plan)
- [👥 Contributing](#-contributing)
- [📄 License](#-license)

## 🌟 Overview

Open CaptchaWorld enables systematic evaluation of multimodal AI capabilities through CAPTCHA-style puzzles. It provides a controlled environment for testing how well LLM Web Agents can:

- Perceive and understand visual elements
- Extract relevant information from images
- Generate appropriate responses to visual puzzles
- Interact with web interfaces to solve tasks

The system includes a variety of CAPTCHA types ranging from basic (count dice) to complex (rotate objects to match reference direction), providing a comprehensive assessment of AI visual reasoning capabilities.

## 🎬 Demo

Watch these demonstration videos to see Open CaptchaWorld in action:

### Demo : Human vs Agent Solving Demo



https://github.com/user-attachments/assets/c1f2edb1-ba9a-403d-9076-706014c0c750



## 🎯 Motivation & Contributions

### Why We Built Open CaptchaWorld

Modern web interfaces increasingly rely on CAPTCHA systems to differentiate between human users and automated systems. This presents a significant challenge for LLM Web Agents attempting to navigate and interact with the real world:

1. **Real-World Deployment Barrier:** Web Agents frequently get stuck on websites that include CAPTCHA tests, significantly slowing down their deployment for everyday real-world usage. Without the ability to solve these challenges, LLM Web Agents cannot fully realize their potential as digital assistants.

2. **Outdated Evaluation Methods:** Many traditional CAPTCHAs can now be easily solved by specialized detection and classification models, making them poor benchmarks for evaluating the complete reasoning, visual understanding, and interaction capabilities of modern Web Agents.

### Our Contributions

Open CaptchaWorld addresses these challenges through several key contributions:

1. **Comprehensive CAPTCHA Collection:** We have collected and implemented an extensive set of modern CAPTCHA types specifically designed to test the multi-modal reasoning capabilities required by Web Agents.

2. **First Open-Source Benchmark:** To our knowledge, this is the first open-sourced CAPTCHA benchmark and dataset specifically tailored for Web Agents, providing a standardized environment for researchers and developers.

3. **Training Data Generation:** Beyond evaluation, Open CaptchaWorld serves as a platform for generating high-quality training data that can improve Web Agents' ability to handle CAPTCHA challenges.

4. **Real-World Simulation:** Our platform closely emulates actual web interfaces, enabling more realistic testing of Web Agents' capabilities to navigate websites protected by CAPTCHA mechanisms.

By making Open CaptchaWorld available to the research community, we aim to accelerate progress in developing more capable, adaptable, and useful Web Agents that can seamlessly interact with today's web interfaces.


## ✨ Features

- **20 CAPTCHA Types**: Diverse set of visual puzzles to test different capabilities
- **Web Interface**: Clean, intuitive interface for human or AI interaction
- **API Endpoints**: Programmatic access to puzzles and verification
- **Benchmark Tracking**: Automatic recording of performance metrics
- **CLI Management**: Tools for managing CAPTCHA puzzles and types
- **Extensible Architecture**: Easy addition of new puzzle types

## 🏗 Project Structure


```
Open CaptchaWorld/
├── app.py                    # Main Flask application
├── manage_captchas.py        # CLI tool for managing CAPTCHA data
├── rotate_images.py          # Utility for generating rotated images
├── benchmark_results.json    # Record of benchmark results
├── requirements.txt          # Python dependencies
├── README.md                 # Project documentation
├── captcha_data/             # Directory containing CAPTCHA types and puzzles
│   ├── Dice_Count/          
│   ├── Geometry_Click/       
│   ├── Rotation_Match/       
│   └── ... (17 more types)   
├── static/                   # Static assets
│   ├── css/
│   │   └── style.css         # CSS styling
│   └── js/
│       └── script.js         # Frontend JavaScript code
└── templates/                # HTML templates
    └── index.html            # Main application page
```


## 🧩 CAPTCHA Types

Open CaptchaWorld includes 20 distinct CAPTCHA types, each testing different visual reasoning capabilities:

1. **Dice_Count**: Count and sum numbers on dice
2. **Geometry_Click**: Click on a specific geometric shape
3. **Rotation_Match**: Rotate an object to match a reference orientation
4. **Slide_Puzzle**: Drag a component to a target position
5. **Unusual_Detection**: Identify unusual items in a grid
6. **Image_Recognition**: Select images matching a description
7. **Bingo**: Swap positions to create a line of matching images
8. **Image_Matching**: Match similar images
9. **Patch_Select**: Select grid squares containing specific objects
10. **Dart_Count**: Select an image where darts sum to a target number
11. **Object_Match**: Match the number of objects to a reference
12. **Select_Animal**: Identify a specific animal in a grid
13. **Coordinates**: Move an object to specified coordinates
14. **Path_Finder**: Navigate to a target position
15. **Place_Dot**: Place a dot at a specific location
16. **Connect_icon**: Connect matching icons
17. **Click_Order**: Click items in a specific sequence
18. **Hold_Button**: Hold a button for a specified duration
19. **Misleading_Click**: Click in the correct area avoiding distractions
20. **Pick_Area**: Select a specific area in an image

Each type has its own directory in `captcha_data/` containing puzzle images and a `ground_truth.json` file with solutions.

## 📊 Benchmark Results

The system records benchmark results in `benchmark_results.json` with each entry containing:
- Puzzle type
- Puzzle ID
- User's answer
- Correct answer
- Boolean indicating correctness
- Timestamp

This data can be used to analyze performance across different puzzle types and track improvement over time.


## 🚀 Getting Started

### Prerequisites

- Python 3.10 or higher

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/username/Open-CaptchaWorld.git
   cd Open-CaptchaWorld
   ```

2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

Start the Flask application:
```bash
python app.py
```

The application will be available at: `http://10.14.0.2:7860/`

## 📝 Usage

### Web Interface

The web interface allows interaction with the CAPTCHA puzzles:

1. Navigate to `http://10.14.0.2:7860/` or you can navigate the huggingface space platform directly `https://huggingface.co/spaces/YaxinLuo/Open_CaptchaWorld`
2. A random CAPTCHA puzzle will be displayed
3. Add the server address to your agent's prompt
4. Aha! Just need to wait for your agents to solve the puzzles


## 🗺️ Future Plan

We're continuously working to improve Open CaptchaWorld. Here's what's on our future plan:
- [x] Add 20 types of Modern Captcha puzzles for Web Agents
- [x] TestBed for evaluating and data collecting
- [x] Web Interface for Open CaptchaWorld
- [x] Make Open CaptchaWorld More easy to use, can just deploy locally and add address to prompt
- [x] Scale Up the Numbers of Captchas to Double Size
- [ ] Increase the number of puzzles in each CAPTCHA type to ensure comprehensive testing
- [ ] Explore parametric approaches for CAPTCHA-solving agents
- [ ] Investigate non-parametric methods for solving complex visual puzzles


As we complete each item, we'll mark the corresponding checkbox to track our progress. We welcome collaboration on any of these initiatives. If you're interested in contributing to a specific roadmap item, please check our issues page or contact the project maintainers.

## 👥 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b new_captchas`)
3. Commit your changes (`git commit -m 'Add new captchas'`)
4. Push to the branch (`git push origin new_captchas`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<div align="center">
  <p>Built with ❤️ for advancing Web LLM Agents research</p>
</div> 
