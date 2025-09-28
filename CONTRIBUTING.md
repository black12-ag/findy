# Contributing to FINDY

First off, thank you for considering contributing to FINDY! 🎉

FINDY is an open-source navigation platform created and maintained by **Munir Ayub**. We welcome contributions from the community to make this project even better.

## 📜 Code of Conduct

By participating in this project, you agree to abide by our code of conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept feedback gracefully
- Show empathy towards other community members

## 🤝 How Can I Contribute?

### Reporting Bugs 🐛

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

1. **Clear Title**: Descriptive title that summarizes the issue
2. **Environment Details**:
   - Browser version
   - Operating system
   - Node.js version (for development)
3. **Steps to Reproduce**: Detailed steps to reproduce the issue
4. **Expected Behavior**: What you expected to happen
5. **Actual Behavior**: What actually happened
6. **Screenshots**: If applicable, add screenshots
7. **Error Messages**: Include any console errors or logs

### Suggesting Enhancements ✨

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

1. **Use a clear title** that describes the suggestion
2. **Provide a detailed description** of the proposed feature
3. **Explain the use case** and why it would be useful
4. **Include mockups or examples** if applicable
5. **Consider the scope** and potential impact

### Pull Requests 🔀

1. **Fork the Repository**
   ```bash
   git clone https://github.com/black12-ag/findy.git
   cd findy
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. **Make Your Changes**
   - Follow the coding style guide
   - Write clear, commented code
   - Update documentation as needed
   - Add tests if applicable

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature" 
   # or "fix: resolve navigation issue"
   ```
   
   Follow conventional commits:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting, etc.)
   - `refactor:` Code refactoring
   - `test:` Adding tests
   - `chore:` Maintenance tasks

5. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Submit a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template
   - Submit for review

## 🎨 Style Guide

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for functions
- Prefer const over let when possible
- Use async/await over promises when appropriate

### CSS/Tailwind
- Use Tailwind CSS classes
- Follow mobile-first responsive design
- Maintain consistent spacing
- Use semantic HTML elements

### React Components
- Use functional components with hooks
- Keep components small and focused
- Use proper prop types/interfaces
- Implement error boundaries where needed
- Follow React best practices

## 📁 Project Structure

```
findy/
├── src/
│   ├── components/     # React components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom hooks
│   ├── utils/          # Utility functions
│   ├── styles/         # Global styles
│   └── types/          # TypeScript types
├── public/             # Static assets
├── backend/            # Backend API (if applicable)
└── docs/              # Documentation
```

## 🧪 Testing

- Write tests for new features
- Ensure existing tests pass
- Run tests before submitting PR:
  ```bash
  npm test
  npm run test:coverage
  ```

## 📝 Documentation

- Update README.md if needed
- Document new features or APIs
- Include code examples
- Update changelog if applicable

## 🔐 Security

- Never commit sensitive data
- Report security vulnerabilities privately to blackde011@gmail.com
- Follow security best practices
- Keep dependencies updated

## 👨‍💼 Attribution & Copyright

All contributions to FINDY become part of the project under the MIT License. By contributing, you agree that:

1. Your contributions are your original work
2. You have the right to submit the work
3. You grant Munir Ayub and the project the right to use your contributions
4. Your contributions will be attributed appropriately

### Contributor Recognition

Contributors will be recognized in:
- The project's CONTRIBUTORS.md file
- Release notes for significant contributions
- Special thanks section in documentation

## 💬 Communication

- **Issues**: Use GitHub Issues for bugs and features
- **Discussions**: Use GitHub Discussions for questions
- **Email**: blackde011@gmail.com for private matters
- **Portfolio**: https://munir-dev-portfolio-2024.netlify.app

## 🚀 Development Setup

1. **Prerequisites**
   - Node.js >= 18.0.0
   - npm >= 8.0.0
   - Git

2. **Installation**
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Add your Google Maps API key
   ```

4. **Start Development**
   ```bash
   npm run dev        # Frontend
   npm run dev:api    # Backend
   ```

## 📋 Pull Request Template

When submitting a PR, please use this template:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added tests
- [ ] All tests pass

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Updated documentation
- [ ] No console errors
- [ ] Mobile responsive
```

## 🙏 Thank You!

Thank you for contributing to FINDY! Your efforts help make navigation better for everyone. Together, we're building something amazing! 🗺️✨

---

**Project Creator & Maintainer**: Munir Ayub  
**GitHub**: [@black12-ag](https://github.com/black12-ag)  
**License**: MIT License - Copyright © 2024-2025 Munir Ayub