# Campus Ghost: Fixing “node is not recognized”

## What this means

If running `node --version` produces a “command not recognized” error, the terminal cannot find Node.js. It may not be installed, or the terminal may need to be reopened after installation.

This command only checks the installed version. It does not create a map node, detect your physical location, or build the application.

## Windows setup

1. Open the official download page: https://nodejs.org/en/download
2. Choose the **LTS** release.
3. Download the **Windows Installer (.msi)**. Do not choose source code or Docker for this setup.
4. Open the installer and follow the prompts, keeping the default options.
5. After installation, close your terminal. If using VS Code, close and reopen VS Code too.
6. Open a new terminal and run:

```bash
node --version
```

### Expected result

A version number beginning with `v` means the terminal can find Node.js. Your exact version may differ from your teammates’ versions.

## If Node.js was already installed

First close and reopen the terminal, then retry:

```bash
node --version
```

## If the command still fails

Share the following with your teammate helping with setup:

- The exact error text or a screenshot.
- Whether you are using Windows or macOS.
- Where you entered the command: PowerShell, Command Prompt, VS Code terminal, or another tool.
- Whether you completed the Node.js installer.

Do not share API keys, passwords, or other secrets in screenshots or GitHub issues.

## Completion checklist

- [ ] Node.js LTS installed.
- [ ] Terminal reopened after installation.
- [ ] `node --version` returns a version number.

This completes the Node.js availability check only. The Campus Ghost application files still need to be added before the app can run.

## Official download source

https://nodejs.org/en/download
