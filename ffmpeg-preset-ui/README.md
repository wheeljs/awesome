# FFmpeg Preset UI

## Introduction

FFmpeg Preset UI is a desktop application built using [Tauri](https://tauri.app), aimed at simplifying video processing tasks. Through a graphical interface, users can easily call [ffmpeg-preset](../ffmpeg-preset/) to transform video instead of remember and type arguments everytime in command line.

## Usage

### Prerequisites

- **[ffmpeg-preset](../ffmpeg-preset/)**: This is a GUI version for commands in ffmpeg-preset, so you should [setup](../ffmpeg-preset/README.md#setup) it before use this tool.

## Development

### Prerequisites

Before you begin enhance or debug, ensure that your development environment has the following tools and libraries installed:

- **[Rust](https://www.rust-lang.org/tools/install)**: rustc 1.8.3 is tested
- **[Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/)**: It's recommended to use [Volta](https://volta.sh/) or [NVM](https://github.com/nvm-sh/nvm) to manage multiple Node.js versions. Node.js 18.20.2 and pnpm 8.15.6 are tested

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/wheeljs/awesome.git
    cd awesome/ffmpeg-preset-ui
    ```

1. Install dependencies:

    ```bash
    pnpm install
    ```

### Running

#### Develop

During development, you can start both the frontend and backend servers simultaneously:

```bash
pnpm tauri dev
```

#### Production Build

TBD

## Project Structure

Below is the typical directory structure of the project:

```
.
├── src-tauri/
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs/
│   │   ├── parser.rs/
│   │   └── utils.rs/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── reusables/
│   ├── App.tsx
│   └── index.tsx
└── package.json
```

`src-tauri/`: Contains Tauri backend logic and build configurations.

`public/`: Static resource files.

`src/`: Contains frontend components and other resources.

`package.json`: Contains npm scripts and dependencies.

## License

This project is licensed under the [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.en.html#license-text) License, see the [LICENSE](../LICENSE) file for details.
