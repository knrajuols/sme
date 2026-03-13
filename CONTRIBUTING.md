# Contributing to SME

Thank you for your interest in contributing to **SME – School Management Excellence**! This guide explains how to submit changes via GitHub Pull Requests.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/<your-username>/sme.git
   cd sme
   ```

3. **Install** dependencies:

   ```bash
   npm install
   ```

## Making Changes

1. Create a **feature branch** off `main`:

   ```bash
   git checkout -b feature/my-improvement
   ```

2. Make your changes, following the existing code style.
3. **Lint and format** your code:

   ```bash
   npm run lint
   npm run format
   ```

4. **Build** to verify there are no compile errors:

   ```bash
   npm run build
   ```

## Opening a Pull Request

1. **Commit** your changes with a clear message:

   ```bash
   git add .
   git commit -m "feat: describe your change"
   ```

2. **Push** the branch to your fork:

   ```bash
   git push origin feature/my-improvement
   ```

3. Navigate to the original repository on GitHub and click **"Compare & pull request"**.
4. Fill in the PR title and description, explaining:
   - **What** the change does
   - **Why** it is needed
   - Any relevant issue numbers (e.g., `Closes #129`)
5. Submit the pull request and respond to any review comments.

## Code Standards

- Follow the existing NestJS / TypeScript patterns in each service.
- All new endpoints must include Swagger decorators.
- Keep services isolated — avoid cross-service direct database access.
- Use the standard response envelope defined in `@sme/common`.

## Questions?

Open an [issue](https://github.com/knrajuols/sme/issues) and we'll be happy to help.
