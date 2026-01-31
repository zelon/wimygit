# wimygit
A lightweight Git GUI client for Windows, inspired by Perforce P4V.

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
- **Command Line Support** - Open directories directly via command line arguments


## Screenshot
![Screenshot](https://raw.githubusercontent.com/zelon/wimygit/master/ScreenShot.png)
![Screenshot1](https://raw.githubusercontent.com/zelon/wimygit/master/ScreenShot1.png)
![Screenshot2](https://raw.githubusercontent.com/zelon/wimygit/master/ScreenShot2.png)

## Installation

### Winget (Recommended)

```powershell
winget install Wimysoft.wimygit
```

### Manual Installation

Download the latest release from [GitHub Releases](https://github.com/zelon/wimygit/releases), extract the zip file, and run the executable.


## Development Environment

| Component | Technology |
|-----------|------------|
| Language  | C# |
| Framework | .NET 10.0 |
| GUI       | WPF |
| Platform  | Windows |
| IDE       | Visual Studio 2026 |

## Coding Style

Following the CoreFX team's coding guidelines:
- [Coding Style Guide](https://github.com/dotnet/runtime/blob/main/docs/coding-guidelines/coding-style.md)
- [.editorconfig](https://github.com/dotnet/runtime/blob/main/.editorconfig)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Tags

`c#` `wpf` `windows` `git` `git-client` `desktop-app`
