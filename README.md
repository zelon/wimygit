# wimygit
A cross-platform Git GUI client for Windows, macOS, and Linux.

## Features

- **Multi-tab Interface** - Manage multiple repositories simultaneously
- **Directory Tree Navigation** - Browse repositories with an intuitive tree view
- **History Viewer** - View and search commit history with detailed diff views
- **Staging Area** - Stage, unstage, and commit changes easily
- **Branch Management** - Create, delete, and checkout branches
- **Remote Operations** - Push, pull, and fetch from remote repositories
- **Stash Support** - Save and restore work in progress
- **Tag Management** - Create and manage Git tags
- **Quick Diff** - Compare commits with parent commits (^1, ^2, etc.)
- **Plugin System** - Extend functionality with plugins


## Screenshot
![Screenshot](https://raw.githubusercontent.com/zelon/wimygit/main/ScreenShot.png)
![Screenshot1](https://raw.githubusercontent.com/zelon/wimygit/main/ScreenShot1.png)
![Screenshot2](https://raw.githubusercontent.com/zelon/wimygit/main/ScreenShot2.png)

## Installation

### Winget (Recommended)

```powershell
winget install Wimysoft.wimygit
```

### Manual Installation

Download the latest release for your platform from [GitHub Releases](https://github.com/zelon/wimygit/releases): `.msi`/`.exe` for Windows, `.dmg` for macOS, or `.deb`/`.rpm`/`.AppImage` for Linux.


#### For MACOS
 Sometimes the gatekeeper blocks the app, run the following command:
```
xattr -c /Applications/Wimygit.app
```

## Development Environment

| Component | Technology |
|-----------|------------|
| Backend   | Rust, [Tauri 2](https://tauri.app/) |
| Frontend  | React 19, TypeScript, Vite, Tailwind CSS |
| Platform  | Windows, macOS, Linux |
| IDE       | VS Code (recommended) |

### Setup

```bash
cd wimygit-tauri
npm install
npm run tauri:dev    # run the app in development mode
npm run tauri:build  # build a release bundle for your platform
```

Requirements: Node.js 24+, a stable Rust toolchain, and (on Linux) `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`.

## Coding Style

- TypeScript/React code is linted with ESLint (`npm run lint` in `wimygit-tauri/`).
- Rust code follows standard `rustfmt` formatting.
- See [`.editorconfig`](.editorconfig) for shared editor settings.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Tags

`rust` `tauri` `react` `typescript` `windows` `macos` `linux` `git` `git-client` `desktop-app`
